import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { ContractsController } from "./contracts.controller";

@Module({
  imports: [PrismaModule],
  controllers: [ContractsController]
})
export class ContractsModule {}
