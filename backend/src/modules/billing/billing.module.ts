import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { BillingController } from "./billing.controller";
import { BillingScheduler } from "./billing.scheduler";
import { BillingService } from "./billing.service";
import { InvoicesController } from "./invoices.controller";

@Module({
  imports: [PrismaModule],
  controllers: [BillingController, InvoicesController],
  providers: [BillingService, BillingScheduler]
})
export class BillingModule {}
