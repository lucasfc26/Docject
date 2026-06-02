import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Req, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiTags } from "@nestjs/swagger";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { extname, join } from "node:path";
import { diskStorage } from "multer";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateFileUploadDto } from "./dto/upload.dto";

const contractUploadDir = join(process.cwd(), "uploads", "contracts");

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

  @Post("contracts")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: (_request, _file, callback) => {
          mkdirSync(contractUploadDir, { recursive: true });
          callback(null, contractUploadDir);
        },
        filename: (_request, file: { originalname: string }, callback) => {
          const extension = extname(file.originalname).toLowerCase() || ".pdf";
          callback(null, `${randomUUID()}${extension}`);
        }
      }),
      fileFilter: (_request, file, callback) => {
        if (file.mimetype !== "application/pdf") {
          callback(new BadRequestException("Envie apenas arquivos PDF."), false);
          return;
        }
        callback(null, true);
      },
      limits: { fileSize: 20 * 1024 * 1024 }
    })
  )
  async uploadContract(
    @Req() request: { headers: Record<string, string | string[] | undefined>; protocol: string },
    @UploadedFile() file?: { filename: string; originalname: string; mimetype: string }
  ) {
    if (!file) {
      throw new BadRequestException("Arquivo PDF obrigatorio.");
    }

    const url = `${requestOrigin(request)}/uploads/contracts/${file.filename}`;
    return this.prisma.fileUpload.create({
      data: {
        filename: file.originalname,
        url,
        mimeType: file.mimetype
      }
    });
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.prisma.fileUpload.delete({ where: { id } });
  }
}

function requestOrigin(request: { headers: Record<string, string | string[] | undefined>; protocol: string }) {
  const forwardedProto = firstHeader(request.headers["x-forwarded-proto"]);
  const forwardedHost = firstHeader(request.headers["x-forwarded-host"]);
  const host = forwardedHost ?? firstHeader(request.headers.host) ?? "localhost:3000";
  const protocol = forwardedProto ?? request.protocol ?? "http";
  return `${protocol}://${host}`;
}

function firstHeader(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
