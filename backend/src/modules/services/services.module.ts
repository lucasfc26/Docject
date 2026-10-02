import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { ServicesController } from "./services.controller";
import { ServiceMonitorService } from "./services.monitor";

@Module({
  imports: [PrismaModule],
  controllers: [ServicesController],
  providers: [ServiceMonitorService]
})
export class ServicesModule {}
