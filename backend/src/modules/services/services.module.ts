import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { ServicesController } from "./services.controller";

@Module({
  imports: [PrismaModule],
  controllers: [ServicesController]
})
export class ServicesModule {}
