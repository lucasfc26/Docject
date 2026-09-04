import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AuthenticatedRequest, serviceScope } from "../../common/current-user";
import { deleteUploadedAttachment, emptyToNull } from "../../common/uploaded-file";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateServiceDto, UpdateServiceDto } from "./dto/service.dto";
import { checkServiceHealth, sanitizeHealthChecks } from "./services.health";
import { syncDueServicePayments, syncOneServicePayments } from "./services.billing";

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

  @Post()
  async create(@Body() body: CreateServiceDto) {
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
  async update(@Param("id") id: string, @Body() body: UpdateServiceDto) {
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
  async remove(@Param("id") id: string) {
    const previous = await this.prisma.service.findUnique({ where: { id } });
    const deleted = await this.prisma.service.delete({ where: { id } });
    await deleteUploadedAttachment(previous?.fileUrl);
    return deleted;
  }
}
