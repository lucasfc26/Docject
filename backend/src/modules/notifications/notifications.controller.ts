import { Body, Controller, Get, Param, Patch, Post, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AuthenticatedRequest } from "../../common/current-user";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateNotificationDto } from "./dto/notification.dto";

@ApiTags("notifications")
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  findAll(@Req() request: AuthenticatedRequest) {
    return this.prisma.notification.findMany({ where: this.notificationScope(request.user), orderBy: { createdAt: "desc" } });
  }

  @Post()
  create(@Body() body: CreateNotificationDto) {
    return this.prisma.notification.create({ data: body });
  }

  @Patch(":id/read")
  markRead(@Param("id") id: string) {
    return this.prisma.notification.update({ where: { id }, data: { read: true } });
  }

  private notificationScope(user?: AuthenticatedRequest["user"]) {
    if (user?.role === "CLIENT") return { module: { project: { client: { users: { some: { id: user.sub } } } } } };
    if (user?.role === "ADMIN") return { OR: [{ module: { project: { client: { OR: [{ ownerId: user.sub }, { ownerId: null }] } } } }, { moduleId: null }] };
    return {};
  }
}
