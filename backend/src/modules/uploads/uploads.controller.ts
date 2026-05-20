import { Body, Controller, Delete, Get, Param, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateFileUploadDto } from "./dto/upload.dto";

@ApiTags("uploads")
@Controller("uploads")
export class UploadsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  findAll() {
    return this.prisma.fileUpload.findMany({ orderBy: { createdAt: "desc" } });
  }

  @Post()
  create(@Body() body: CreateFileUploadDto) {
    return this.prisma.fileUpload.create({ data: body });
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.prisma.fileUpload.delete({ where: { id } });
  }
}
