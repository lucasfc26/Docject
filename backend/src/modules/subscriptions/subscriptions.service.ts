import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { Subscription } from "@prisma/client";
import {
  AsaasPayment,
  PAID_PAYMENT_STATUSES,
  asaasDueDate,
  onlyDigits,
  platformAsaasClient,
} from "../../common/asaas/asaas.client";
import { PrismaService } from "../../prisma/prisma.service";
import { ACCESS_GRACE_DAYS, PLANS, PlanId, isPlatformOwner } from "./subscription.plans";

const ACCESS_CACHE_MS = 60_000;

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);
  /** Positive access checks only, so a confirmed payment unlocks the account right away. */
  private readonly accessCache = new Map<string, number>();

  constructor(private readonly prisma: PrismaService) {}

  async current(adminId: string) {
    let subscription = await this.ensure(adminId);
    if (subscription.status !== "ACTIVE" && subscription.asaasPaymentId) {
      subscription = await this.refreshPendingPayment(subscription);
    }
    return this.present(subscription, await this.isOwner(adminId));
  }

  /** Whether the admin (and the staff created by them) may use the system. */
  async hasAccess(adminId: string) {
    const cachedAt = this.accessCache.get(adminId);
    if (cachedAt && Date.now() - cachedAt < ACCESS_CACHE_MS) return true;
    const subscription = await this.prisma.subscription.findUnique({ where: { userId: adminId } });
    const allowed = (subscription !== null && periodIsPaid(subscription)) || (await this.isOwner(adminId));
    if (allowed) this.accessCache.set(adminId, Date.now());
    else this.accessCache.delete(adminId);
    return allowed;
  }

  /** Starts (or restarts) the checkout of a paid plan. */
  async checkout(adminId: string, plan: PlanId, cpfCnpj?: string) {
    const subscription = await this.ensure(adminId);
    const asaas = platformAsaasClient();
    if (!asaas) throw new ServiceUnavailableException("Pagamentos de assinatura ainda nao estao configurados.");

    const document = onlyDigits(cpfCnpj) || subscription.cpfCnpj || "";
    if (document.length !== 11 && document.length !== 14) {
      throw new BadRequestException("Informe um CPF ou CNPJ valido para emitir a cobranca.");
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: adminId },
      select: { id: true, name: true, email: true, phone: true },
    });

    let customerId = subscription.cpfCnpj === document ? subscription.asaasCustomerId : null;
    if (!customerId) {
      const customer = await asaas.createCustomer({
        name: user.name,
        cpfCnpj: document,
        email: user.email,
        phone: onlyDigits(user.phone) || undefined,
        externalReference: `user:${user.id}`,
      });
      customerId = customer.id;
    }

    if (subscription.asaasSubscriptionId) {
      await asaas.cancelSubscription(subscription.asaasSubscriptionId).catch(() => undefined);
    }

    const definition = PLANS[plan];
    const description = `Docject - plano ${definition.name}`;
    let asaasSubscriptionId: string | null = null;
    let payment: AsaasPayment | undefined;

    if (plan === "MONTHLY") {
      const created = await asaas.createSubscription({
        customer: customerId,
        billingType: "UNDEFINED",
        value: definition.price,
        nextDueDate: asaasDueDate(),
        cycle: "MONTHLY",
        description,
        externalReference: `subscription:${subscription.id}`,
      });
      asaasSubscriptionId = created.id;
      payment = (await asaas.subscriptionPayments(created.id)).data[0];
    } else {
      payment = await asaas.createPayment({
        customer: customerId,
        billingType: "UNDEFINED",
        value: definition.price,
        dueDate: asaasDueDate(),
        description,
        externalReference: `subscription:${subscription.id}`,
      });
    }

    // A paid period still running stays valid while the new plan is being paid.
    const saved = await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        plan,
        status: periodIsPaid(subscription) ? subscription.status : "PENDING",
        cpfCnpj: document,
        asaasCustomerId: customerId,
        asaasSubscriptionId,
        asaasPaymentId: payment?.id ?? null,
        checkoutUrl: payment?.invoiceUrl ?? null,
      },
    });
    return this.present(saved, await this.isOwner(adminId));
  }

  /** Stops the recurring charge; access remains until the end of the paid period. */
  async cancel(adminId: string) {
    const subscription = await this.ensure(adminId);
    const asaas = platformAsaasClient();
    if (subscription.asaasSubscriptionId && asaas) {
      await asaas.cancelSubscription(subscription.asaasSubscriptionId).catch((error) =>
        this.logger.warn(`Falha ao cancelar assinatura Asaas ${subscription.asaasSubscriptionId}: ${error}`),
      );
    }
    const saved = await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: "CANCELLED", asaasSubscriptionId: null, checkoutUrl: null },
    });
    this.accessCache.delete(adminId);
    return this.present(saved, await this.isOwner(adminId));
  }

  /** Handles payment events from the platform Asaas account. */
  async handlePaymentEvent(event: string, payment: AsaasPayment) {
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        OR: [
          { asaasPaymentId: payment.id },
          ...(payment.subscription ? [{ asaasSubscriptionId: payment.subscription }] : []),
        ],
      },
    });
    if (!subscription) return { ok: true, ignored: true };

    if (event === "PAYMENT_RECEIVED" || event === "PAYMENT_CONFIRMED" || PAID_PAYMENT_STATUSES.has(payment.status)) {
      await this.activate(subscription, payment.id);
    } else if (event === "PAYMENT_OVERDUE") {
      this.accessCache.delete(subscription.userId);
      await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: "OVERDUE", asaasPaymentId: payment.id, checkoutUrl: payment.invoiceUrl ?? subscription.checkoutUrl },
      });
    } else if (event === "PAYMENT_CREATED" && subscription.asaasSubscriptionId === payment.subscription) {
      await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: { asaasPaymentId: payment.id, checkoutUrl: payment.invoiceUrl ?? subscription.checkoutUrl },
      });
    }
    return { ok: true };
  }

  ensure(userId: string) {
    return this.prisma.subscription.upsert({
      where: { userId },
      update: {},
      create: { userId, plan: "MONTHLY", status: "PENDING" },
    });
  }

  private async refreshPendingPayment(subscription: Subscription) {
    const asaas = platformAsaasClient();
    if (!asaas || !subscription.asaasPaymentId) return subscription;
    try {
      const payment = await asaas.getPayment(subscription.asaasPaymentId);
      if (PAID_PAYMENT_STATUSES.has(payment.status)) return this.activate(subscription, payment.id);
    } catch (error) {
      this.logger.warn(`Falha ao consultar pagamento ${subscription.asaasPaymentId}: ${error}`);
    }
    return subscription;
  }

  private activate(subscription: Subscription, paymentId: string) {
    // Repeated notifications of the same payment must not extend the period twice.
    if (subscription.status === "ACTIVE" && subscription.asaasPaymentId === paymentId) return subscription;
    const base =
      subscription.currentPeriodEnd && subscription.currentPeriodEnd > new Date()
        ? new Date(subscription.currentPeriodEnd)
        : new Date();
    base.setMonth(base.getMonth() + PLANS[subscription.plan].periodMonths);
    return this.prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: "ACTIVE", asaasPaymentId: paymentId, currentPeriodEnd: base, checkoutUrl: null },
    });
  }

  private async isOwner(adminId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: adminId }, select: { email: true } });
    return isPlatformOwner(user?.email);
  }

  private present(subscription: Subscription, ownerExempt: boolean) {
    return {
      plan: subscription.plan,
      status: subscription.status,
      active: ownerExempt || periodIsPaid(subscription),
      ownerExempt,
      checkoutUrl: subscription.checkoutUrl,
      currentPeriodEnd: subscription.currentPeriodEnd,
      hasDocument: Boolean(subscription.cpfCnpj),
      paymentsEnabled: Boolean(process.env.ASAAS_API_KEY),
      plans: Object.values(PLANS),
    };
  }
}

/** Access lasts until the last paid period (plus grace) ends, even after a cancellation. */
function periodIsPaid(subscription: Subscription) {
  if (!subscription.currentPeriodEnd) return false;
  const limit = new Date(subscription.currentPeriodEnd);
  limit.setDate(limit.getDate() + ACCESS_GRACE_DAYS);
  return limit > new Date();
}
