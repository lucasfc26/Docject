import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { FinancialController } from "./financial.controller";

@Module({
  imports: [PrismaModule],
  controllers: [FinancialController]
})
export class FinancialModule {}
