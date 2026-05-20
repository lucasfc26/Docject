import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateResourceDto, UpdateResourceDto } from "./dto/resource.dto";

@ApiTags("resources")
@Controller("resources")
export class ResourcesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  findAll() {
    return this.prisma.resource.findMany({ orderBy: { createdAt: "desc" } });
  }

  @Post()
  create(@Body() body: CreateResourceDto) {
    return this.prisma.resource.create({ data: body });
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() body: UpdateResourceDto) {
    return this.prisma.resource.update({ where: { id }, data: body });
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.prisma.resource.delete({ where: { id } });
  }
}
