import { Body, Controller, Delete, ForbiddenException, Get, NotFoundException, Param, Patch, Post, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AuthenticatedRequest, serviceScope } from "../../common/current-user";
import { deleteUploadedAttachment, emptyToNull } from "../../common/uploaded-file";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateServiceDto, CreateServiceWorkLogDto, UpdateServiceDto, UpdateServiceReportDto } from "./dto/service.dto";
import { checkServiceHealth, sanitizeHealthChecks } from "./services.health";
import { syncDueServicePayments, syncOneServicePayments } from "./services.billing";
import { buildServiceHours, isValidMonth } from "./services.hours";
import { buildMonthlyReport, closeMonthlyReport, monthKeyInZone, reportMonths, systemTimezone } from "./services.reports";

const STAFF_ROLES = ["ADMIN", "MANAGER"];
const STAFF_READ_ROLES = ["ADMIN", "MANAGER", "FINANCIAL"];

function assertRole(request: AuthenticatedRequest, roles: string[]) {
  const role = request.user?.role;
  if (!role || !roles.includes(role)) {
    throw new ForbiddenException("Seu perfil nao tem permissao para esta acao.");
  }
}

@ApiTags("services")
@Controller("services")
export class ServicesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async findAll(@Req() request: AuthenticatedRequest) {
    await syncDueServicePayments(this.prisma);
    return this.prisma.service.findMany({
      where: serviceScope(request.user),
      include: { client: true, transactions: { orderBy: { dueDate: "desc" } } },
      orderBy: { createdAt: "desc" }
    });
  }

  @Get(":id/health-checks")
  async checkHealth(@Param("id") id: string) {
    const service = await this.prisma.service.findUnique({
      where: { id },
      select: { healthChecks: true }
    });
    const checks = sanitizeHealthChecks(service?.healthChecks);
    return Promise.all(checks.map(checkServiceHealth));
  }

  @Get(":id/work-logs")
  async workLogs(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    const service = await this.findScopedService(id, request, STAFF_READ_ROLES);
    const logs = await this.prisma.serviceWorkLog.findMany({
      where: { serviceId: id },
      include: { createdBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" }
    });
    return {
      monthlyHours: Number(service.monthlyHours),
      hoursExpirePercent: service.hoursExpirePercent,
      hoursExpirationMonths: service.hoursExpirationMonths,
      months: buildServiceHours(service, logs)
    };
  }

  @Post(":id/work-logs")
  async createWorkLog(@Param("id") id: string, @Body() body: CreateServiceWorkLogDto, @Req() request: AuthenticatedRequest) {
    await this.findScopedService(id, request, STAFF_ROLES);
    return this.prisma.serviceWorkLog.create({
      data: {
        serviceId: id,
        month: body.month,
        hours: body.hours,
        description: body.description.trim(),
        createdById: request.user?.sub
      }
    });
  }

  @Delete(":id/work-logs/:logId")
  async removeWorkLog(@Param("id") id: string, @Param("logId") logId: string, @Req() request: AuthenticatedRequest) {
    await this.findScopedService(id, request, STAFF_ROLES);
    const log = await this.prisma.serviceWorkLog.findFirst({ where: { id: logId, serviceId: id } });
    if (!log) throw new NotFoundException("Registro de horas nao encontrado.");
    return this.prisma.serviceWorkLog.delete({ where: { id: logId } });
  }

  @Get(":id/reports")
  async reports(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    const service = await this.findScopedService(id, request);
    const timeZone = await systemTimezone(this.prisma);
    const stored = await this.prisma.serviceMonthlyReport.findMany({
      where: { serviceId: id },
      select: { month: true, closedAt: true, availabilityPercent: true }
    });
    const byMonth = new Map(stored.map((report) => [report.month, report]));
    return reportMonths(service.startDate, timeZone).map((month) => ({
      month,
      status: byMonth.get(month)?.closedAt ? "CLOSED" : "OPEN",
      availabilityPercent: byMonth.get(month)?.closedAt ? byMonth.get(month)?.availabilityPercent ?? null : null
    }));
  }

  @Get(":id/reports/:month")
  async report(@Param("id") id: string, @Param("month") month: string, @Req() request: AuthenticatedRequest) {
    if (!isValidMonth(month)) throw new NotFoundException("Mes invalido.");
    const service = await this.findScopedService(id, request);
    const timeZone = await systemTimezone(this.prisma);
    return {
      ...(await buildMonthlyReport(this.prisma, service, month, timeZone)),
      current: month === monthKeyInZone(new Date(), timeZone)
    };
  }

  @Patch(":id/reports/:month")
  async updateReport(
    @Param("id") id: string,
    @Param("month") month: string,
    @Body() body: UpdateServiceReportDto,
    @Req() request: AuthenticatedRequest
  ) {
    if (!isValidMonth(month)) throw new NotFoundException("Mes invalido.");
    const service = await this.findScopedService(id, request, STAFF_ROLES);
    const data = {
      ...(body.backupStatus !== undefined ? { backupStatus: body.backupStatus || null } : {}),
      ...(body.backupNotes !== undefined ? { backupNotes: body.backupNotes.trim() || null } : {}),
      ...(body.incidentNotes !== undefined ? { incidentNotes: body.incidentNotes.trim() || null } : {}),
      ...(body.otherOccurrences !== undefined ? { otherOccurrences: body.otherOccurrences.trim() || null } : {}),
      updatedById: request.user?.sub
    };
    await this.prisma.serviceMonthlyReport.upsert({
      where: { serviceId_month: { serviceId: id, month } },
      create: { serviceId: id, month, ...data },
      update: data
    });
    const timeZone = await systemTimezone(this.prisma);
    return buildMonthlyReport(this.prisma, service, month, timeZone);
  }

  @Post(":id/reports/:month/recalculate")
  async recalculateReport(@Param("id") id: string, @Param("month") month: string, @Req() request: AuthenticatedRequest) {
    if (!isValidMonth(month)) throw new NotFoundException("Mes invalido.");
    const service = await this.findScopedService(id, request, STAFF_ROLES);
    const timeZone = await systemTimezone(this.prisma);
    if (month >= monthKeyInZone(new Date(), timeZone)) {
      throw new ForbiddenException("O mes atual ainda esta em apuracao.");
    }
    await closeMonthlyReport(this.prisma, id, month, timeZone);
    return buildMonthlyReport(this.prisma, service, month, timeZone);
  }

  @Post()
  async create(@Body() body: CreateServiceDto, @Req() request: AuthenticatedRequest) {
    assertRole(request, STAFF_ROLES);
    const service = await this.prisma.service.create({
      data: {
        ...body,
        startDate: new Date(body.startDate),
        fileUrl: emptyToNull(body.fileUrl),
        fileName: emptyToNull(body.fileName)
      } as never,
      include: { client: true }
    });
    await syncOneServicePayments(this.prisma, service.id);
    return service;
  }

  @Patch(":id")
  async update(@Param("id") id: string, @Body() body: UpdateServiceDto, @Req() request: AuthenticatedRequest) {
    assertRole(request, STAFF_ROLES);
    const previous = await this.prisma.service.findUnique({ where: { id } });
    const nextFileUrl = body.fileUrl !== undefined ? emptyToNull(body.fileUrl) : undefined;
    if (previous?.fileUrl && nextFileUrl !== undefined && nextFileUrl !== previous.fileUrl) {
      await deleteUploadedAttachment(previous.fileUrl);
    }
    const service = await this.prisma.service.update({
      where: { id },
      data: {
        ...body,
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        ...(body.fileUrl !== undefined ? { fileUrl: nextFileUrl } : {}),
        ...(body.fileName !== undefined ? { fileName: emptyToNull(body.fileName) } : {})
      } as never,
      include: { client: true }
    });
    await syncOneServicePayments(this.prisma, service.id);
    return service;
  }

  @Delete(":id")
  async remove(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    assertRole(request, STAFF_ROLES);
    const previous = await this.prisma.service.findUnique({ where: { id } });
    const deleted = await this.prisma.service.delete({ where: { id } });
    await deleteUploadedAttachment(previous?.fileUrl);
    return deleted;
  }

  private async findScopedService(id: string, request: AuthenticatedRequest, roles?: string[]) {
    if (roles) assertRole(request, roles);
    const service = await this.prisma.service.findFirst({
      where: { id, ...serviceScope(request.user) },
      include: { client: { select: { name: true } } }
    });
    if (!service) throw new NotFoundException("Servico nao encontrado.");
    return service;
  }
}
