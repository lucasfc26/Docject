import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { AppointmentsController } from "./appointments.controller";

@Module({
  imports: [PrismaModule],
  controllers: [AppointmentsController]
})
export class AppointmentsModule {}
