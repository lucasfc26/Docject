import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { BillingController } from "./billing.controller";
import { BillingScheduler } from "./billing.scheduler";
import { BillingService } from "./billing.service";

@Module({
  imports: [PrismaModule],
  controllers: [BillingController],
  providers: [BillingService, BillingScheduler]
})
export class BillingModule {}
