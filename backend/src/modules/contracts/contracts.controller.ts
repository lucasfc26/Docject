import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AuthenticatedRequest, contractScope } from "../../common/current-user";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateContractDto, CreateContractVersionDto, UpdateContractDto } from "./dto/contract.dto";

@ApiTags("contracts")
@Controller("contracts")
export class ContractsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  findAll(@Req() request: AuthenticatedRequest) {
    return this.prisma.contract.findMany({ where: contractScope(request.user), include: { versions: true, client: true }, orderBy: { createdAt: "desc" } });
  }

  @Post()
  create(@Body() body: CreateContractDto) {
    return this.prisma.contract.create({ data: body as never });
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() body: UpdateContractDto) {
    return this.prisma.contract.update({ where: { id }, data: body as never });
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.prisma.contract.delete({ where: { id } });
  }

  @Post(":id/versions")
  addVersion(@Param("id") contractId: string, @Body() body: CreateContractVersionDto) {
    return this.prisma.contractVersion.create({ data: { ...body, contractId } });
  }
}
