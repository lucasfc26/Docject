import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AuthenticatedRequest, clientScope } from "../../common/current-user";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateClientContactDto, CreateClientDto, UpdateClientDto } from "./dto/client.dto";

@ApiTags("clients")
@Controller("clients")
export class ClientsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  findAll(@Req() request: AuthenticatedRequest) {
    return this.prisma.client.findMany({
      where: clientScope(request.user),
      include: { contacts: true, projects: true },
      orderBy: { createdAt: "desc" }
    });
  }

  @Get(":id")
  findOne(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.prisma.client.findFirst({
      where: { id, ...clientScope(request.user) },
      include: { contacts: true, projects: { include: { modules: true } } }
    });
  }

  @Post()
  create(@Body() body: CreateClientDto, @Req() request: AuthenticatedRequest) {
    return this.prisma.client.create({ data: { ...body, ownerId: request.user?.sub } });
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() body: UpdateClientDto) {
    return this.prisma.client.update({ where: { id }, data: body });
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.prisma.client.delete({ where: { id } });
  }

  @Post(":id/contacts")
  addContact(@Param("id") clientId: string, @Body() body: CreateClientContactDto) {
    return this.prisma.clientContact.create({ data: { ...body, clientId } });
  }
}
