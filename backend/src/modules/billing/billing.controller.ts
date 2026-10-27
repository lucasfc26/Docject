import { Body, Controller, Delete, ForbiddenException, Get, Headers, Param, Post, Put, Req, UnauthorizedException } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AsaasFiscalInvoice, AsaasPayment } from "../../common/asaas/asaas.client";
import { AuthenticatedRequest } from "../../common/current-user";
import { Public } from "../../common/public.decorator";
import { resolveResponsibleAdminId } from "../../common/responsible-admin";
import { PrismaService } from "../../prisma/prisma.service";
import { BillingService } from "./billing.service";
import { ChargeTransactionDto, SaveAsaasCredentialDto } from "./dto/billing.dto";

@ApiTags("billing")
@Controller("billing")
export class BillingController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: BillingService,
  ) {}

  /** Only the admin manages the Asaas account; managers and financial staff just issue invoices. */
  @Get("credentials")
  credential(@Req() request: AuthenticatedRequest) {
    return this.billing.credential(this.adminOnly(request));
  }

  @Put("credentials")
  saveCredential(@Req() request: AuthenticatedRequest, @Body() body: SaveAsaasCredentialDto) {
    return this.billing.saveCredential(this.adminOnly(request), body);
  }

  @Delete("credentials")
  removeCredential(@Req() request: AuthenticatedRequest) {
    return this.billing.removeCredential(this.adminOnly(request));
  }

  @Get("credentials/webhook-token")
  webhookToken(@Req() request: AuthenticatedRequest) {
    return this.billing.revealWebhookToken(this.adminOnly(request));
  }

  @Post("credentials/test")
  testCredential(@Req() request: AuthenticatedRequest) {
    return this.billing.testCredential(this.adminOnly(request));
  }

  @Post("transactions/:id/charge")
  async charge(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body() body: ChargeTransactionDto) {
    return this.billing.charge(await this.staffAdminId(request), id, body.billingType);
  }

  @Post("transactions/:id/sync")
  async sync(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.billing.syncCharge(await this.staffAdminId(request), id);
  }

  @Post("transactions/:id/nfse")
  async emitNfse(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.billing.emitNfse(await this.staffAdminId(request), id);
  }

  @Delete("transactions/:id/charge")
  async cancel(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.billing.cancelCharge(await this.staffAdminId(request), id);
  }

  @Public()
  @Post("webhook/:credentialId")
  webhook(
    @Param("credentialId") credentialId: string,
    @Headers("asaas-access-token") token: string | undefined,
    @Body() body: { event?: string; payment?: AsaasPayment; invoice?: AsaasFiscalInvoice },
  ) {
    return this.billing.handleWebhook(credentialId, token, body);
  }

  private adminOnly(request: AuthenticatedRequest) {
    if (request.user?.role !== "ADMIN") throw new ForbiddenException("Apenas o administrador gerencia as chaves do Asaas.");
    return request.user.sub;
  }

  /** Admins, managers and financial staff charge through the admin's Asaas account. */
  private staffAdminId(request: AuthenticatedRequest) {
    const user = request.user;
    if (!user) throw new UnauthorizedException();
    if (user.role === "CLIENT") throw new ForbiddenException();
    return resolveResponsibleAdminId(this.prisma, user.sub);
  }
}
