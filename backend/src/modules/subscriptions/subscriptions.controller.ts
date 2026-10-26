import { Body, Controller, ForbiddenException, Get, Headers, Post, Req, UnauthorizedException } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AsaasPayment } from "../../common/asaas/asaas.client";
import { AuthenticatedRequest } from "../../common/current-user";
import { Public } from "../../common/public.decorator";
import { resolveResponsibleAdminId } from "../../common/responsible-admin";
import { webhookTokenMatches } from "../../common/webhook-token";
import { PrismaService } from "../../prisma/prisma.service";
import { CheckoutSubscriptionDto } from "./dto/subscription.dto";
import { PLANS } from "./subscription.plans";
import { SubscriptionsService } from "./subscriptions.service";

@ApiTags("subscription")
@Controller("subscription")
export class SubscriptionsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  @Public()
  @Get("plans")
  plans() {
    return Object.values(PLANS);
  }

  @Get()
  async current(@Req() request: AuthenticatedRequest) {
    const adminId = await this.adminId(request);
    return this.subscriptions.current(adminId);
  }

  @Post("checkout")
  async checkout(@Req() request: AuthenticatedRequest, @Body() body: CheckoutSubscriptionDto) {
    if (request.user?.role !== "ADMIN") throw new ForbiddenException("Apenas o administrador pode alterar o plano.");
    return this.subscriptions.checkout(request.user.sub, body.plan, body.cpfCnpj);
  }

  @Post("cancel")
  cancel(@Req() request: AuthenticatedRequest) {
    if (request.user?.role !== "ADMIN") throw new ForbiddenException("Apenas o administrador pode cancelar o plano.");
    return this.subscriptions.cancel(request.user.sub);
  }

  /** Webhook of the platform Asaas account (configure ASAAS_WEBHOOK_TOKEN in the Asaas panel). */
  @Public()
  @Post("webhook")
  webhook(
    @Headers("asaas-access-token") token: string | undefined,
    @Body() body: { event?: string; payment?: AsaasPayment },
  ) {
    if (!webhookTokenMatches(token, process.env.ASAAS_WEBHOOK_TOKEN)) throw new UnauthorizedException();
    if (!body.event || !body.payment?.id) return { ok: true, ignored: true };
    return this.subscriptions.handlePaymentEvent(body.event, body.payment);
  }

  private adminId(request: AuthenticatedRequest) {
    if (!request.user) throw new UnauthorizedException();
    return resolveResponsibleAdminId(this.prisma, request.user.sub);
  }
}
