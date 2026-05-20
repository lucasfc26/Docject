import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { FeaturesController } from "./features.controller";

@Module({
  imports: [PrismaModule],
  controllers: [FeaturesController]
})
export class FeaturesModule {}
