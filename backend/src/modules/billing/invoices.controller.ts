import { Controller, ForbiddenException, Get, Param, Req, UnauthorizedException } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AuthenticatedRequest } from "../../common/current-user";
import { BillingService } from "./billing.service";

@ApiTags("invoices")
@Controller("invoices")
export class InvoicesController {
  constructor(private readonly billing: BillingService) {}

  /** Invoices of the logged client (pending, overdue and paid). */
  @Get()
  list(@Req() request: AuthenticatedRequest) {
    if (!request.user) throw new UnauthorizedException();
    if (request.user.role !== "CLIENT") throw new ForbiddenException("Use o Financeiro para ver as faturas dos clientes.");
    return this.billing.clientInvoices(request.user);
  }

  @Get(":id")
  detail(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    if (!request.user) throw new UnauthorizedException();
    return this.billing.invoice(request.user, id);
  }
}
