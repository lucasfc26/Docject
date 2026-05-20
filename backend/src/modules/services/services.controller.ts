import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AuthenticatedRequest, serviceScope } from "../../common/current-user";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateServiceDto, UpdateServiceDto } from "./dto/service.dto";
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

  @Post()
  async create(@Body() body: CreateServiceDto) {
    const service = await this.prisma.service.create({
      data: { ...body, startDate: new Date(body.startDate) } as never,
      include: { client: true }
    });
    await syncOneServicePayments(this.prisma, service.id);
    return service;
  }

  @Patch(":id")
  async update(@Param("id") id: string, @Body() body: UpdateServiceDto) {
    const service = await this.prisma.service.update({
      where: { id },
      data: { ...body, startDate: body.startDate ? new Date(body.startDate) : undefined } as never,
      include: { client: true }
    });
    await syncOneServicePayments(this.prisma, service.id);
    return service;
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.prisma.service.delete({ where: { id } });
  }
}
