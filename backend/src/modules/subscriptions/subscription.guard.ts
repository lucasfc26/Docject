import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { AuthenticatedRequest } from "../../common/current-user";
import { resolveResponsibleAdminId } from "../../common/responsible-admin";
import { PrismaService } from "../../prisma/prisma.service";
import { SubscriptionsService } from "./subscriptions.service";

/** Requests a staff user may still make while the admin's plan is unpaid, so they can reach the payment screen. */
const ALWAYS_ALLOWED: Array<{ method?: string; prefix: string }> = [
  { prefix: "/api/auth" },
  { prefix: "/api/subscription" },
  { method: "GET", prefix: "/api/users" },
  { method: "GET", prefix: "/api/settings" },
  { method: "GET", prefix: "/api/features" },
];

/**
 * Admin, manager and financial accounts are paid: they only work while the responsible
 * admin has a paid subscription. Client accounts are free. Runs after JwtAuthGuard.
 */
@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    if (!user || user.role === "CLIENT") return true;

    const path = request.path;
    const exempt = ALWAYS_ALLOWED.some(
      (rule) => (!rule.method || rule.method === request.method) && (path === rule.prefix || path.startsWith(`${rule.prefix}/`)),
    );
    if (exempt) return true;

    const adminId = await resolveResponsibleAdminId(this.prisma, user.sub);
    if (await this.subscriptions.hasAccess(adminId)) return true;

    throw new HttpException(
      {
        statusCode: HttpStatus.PAYMENT_REQUIRED,
        code: "SUBSCRIPTION_REQUIRED",
        message:
          user.role === "ADMIN"
            ? "Sua assinatura nao esta ativa. Conclua o pagamento em Configuracoes > Assinatura."
            : "A assinatura do administrador desta conta nao esta ativa.",
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}
