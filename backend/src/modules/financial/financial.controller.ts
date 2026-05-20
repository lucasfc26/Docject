import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AuthenticatedRequest } from "../../common/current-user";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateFinancialTransactionDto, UpdateFinancialTransactionDto } from "./dto/financial.dto";
import { syncDueServicePayments } from "../services/services.billing";

@ApiTags("financial")
@Controller("financial")
export class FinancialController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async findAll(@Req() request: AuthenticatedRequest) {
    await syncDueServicePayments(this.prisma);
    await this.refreshOverduePayments();
    return this.prisma.financialTransaction.findMany({
      where: this.transactionScope(request.user),
      include: { module: { include: { project: { include: { client: true } } } }, service: { include: { client: true } } },
      orderBy: [{ dueDate: "desc" }, { createdAt: "desc" }]
    });
  }

  @Post()
  create(@Body() body: CreateFinancialTransactionDto) {
    return this.prisma.financialTransaction.create({
      data: this.normalizeTransactionData(body) as never
    });
  }

  @Patch(":id")
  async update(@Param("id") id: string, @Body() body: UpdateFinancialTransactionDto) {
    await this.refreshOverduePayments();
    const current = await this.prisma.financialTransaction.findUnique({ where: { id } });
    return this.prisma.financialTransaction.update({
      where: { id },
      data: this.normalizeTransactionData(body, current ?? undefined) as never
    });
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.prisma.financialTransaction.delete({ where: { id } });
  }

  @Get("summary")
  async summary(@Req() request: AuthenticatedRequest) {
    await syncDueServicePayments(this.prisma);
    await this.refreshOverduePayments();
    const transactions = await this.prisma.financialTransaction.findMany({ where: this.transactionScope(request.user) });
    const revenue = transactions.filter((item) => item.kind === "REVENUE").reduce((sum, item) => sum + Math.abs(Number(item.amount)), 0);
    const expenses = transactions.filter((item) => item.kind === "EXPENSE").reduce((sum, item) => sum + Math.abs(Number(item.amount)), 0);
    const pending = transactions.filter((item) => item.status === "PENDING").reduce((sum, item) => sum + Math.abs(Number(item.amount)), 0);
    const overdue = transactions.filter((item) => item.status === "OVERDUE").reduce((sum, item) => sum + Math.abs(Number(item.amount)), 0);
    return { revenue, expenses, pending, overdue, netProfit: revenue - expenses };
  }

  private normalizeTransactionData(
    body: CreateFinancialTransactionDto | UpdateFinancialTransactionDto,
    current?: { amount: unknown; kind: string }
  ) {
    const kind = body.kind ?? current?.kind ?? "REVENUE";
    const sourceAmount = body.amount ?? Number(current?.amount ?? 0);
    const amount = kind === "EXPENSE" ? -Math.abs(Number(sourceAmount)) : Math.abs(Number(sourceAmount));
    return {
      ...body,
      kind,
      amount,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined
    };
  }

  private refreshOverduePayments() {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - 3);
    threshold.setHours(23, 59, 59, 999);

    return this.prisma.financialTransaction.updateMany({
      where: {
        status: "PENDING",
        dueDate: { lt: threshold }
      },
      data: { status: "OVERDUE" }
    });
  }

  private transactionScope(user?: AuthenticatedRequest["user"]) {
    if (user?.role === "CLIENT") {
      return {
        OR: [
          { module: { project: { client: { users: { some: { id: user.sub } } } } } },
          { service: { client: { users: { some: { id: user.sub } } } } }
        ]
      };
    }
    if (user?.role === "ADMIN") {
      return {
        OR: [
          { module: { project: { client: { OR: [{ ownerId: user.sub }, { ownerId: null }] } } } },
          { service: { client: { OR: [{ ownerId: user.sub }, { ownerId: null }] } } },
          { moduleId: null, serviceId: null }
        ]
      };
    }
    return {};
  }
}
