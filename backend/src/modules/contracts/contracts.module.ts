import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { ContractPdfService } from "./contract-pdf.service";
import { ContractsController } from "./contracts.controller";

@Module({
  imports: [PrismaModule],
  controllers: [ContractsController],
  providers: [ContractPdfService]
})
export class ContractsModule {}
