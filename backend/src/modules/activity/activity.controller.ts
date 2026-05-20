import { Body, Controller, Get, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateActivityLogDto } from "./dto/activity.dto";

@ApiTags("activity")
@Controller("activity")
export class ActivityController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  findAll() {
    return this.prisma.activityLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  }

  @Post()
  create(@Body() body: CreateActivityLogDto) {
    return this.prisma.activityLog.create({ data: body as never });
  }
}
