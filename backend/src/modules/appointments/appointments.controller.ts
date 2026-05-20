import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AuthenticatedRequest } from "../../common/current-user";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateAppointmentDto, UpdateAppointmentDto } from "./dto/appointment.dto";

@ApiTags("appointments")
@Controller("appointments")
export class AppointmentsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  findAll(@Req() request: AuthenticatedRequest) {
    return this.prisma.appointment.findMany({ where: this.appointmentScope(request.user), orderBy: { startsAt: "asc" } });
  }

  @Post()
  create(@Body() body: CreateAppointmentDto) {
    return this.prisma.appointment.create({
      data: {
        ...body,
        startsAt: new Date(body.startsAt),
        endsAt: body.endsAt ? new Date(body.endsAt) : undefined
      }
    });
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() body: UpdateAppointmentDto) {
    return this.prisma.appointment.update({
      where: { id },
      data: {
        ...body,
        startsAt: body.startsAt ? new Date(body.startsAt) : undefined,
        endsAt: body.endsAt ? new Date(body.endsAt) : undefined
      }
    });
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.prisma.appointment.delete({ where: { id } });
  }

  private appointmentScope(user?: AuthenticatedRequest["user"]) {
    if (user?.role === "CLIENT") return { module: { project: { client: { users: { some: { id: user.sub } } } } } };
    if (user?.role === "ADMIN") return { OR: [{ module: { project: { client: { OR: [{ ownerId: user.sub }, { ownerId: null }] } } } }, { moduleId: null }] };
    return {};
  }
}
