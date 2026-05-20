import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { UploadsController } from "./uploads.controller";

@Module({
  imports: [PrismaModule],
  controllers: [UploadsController]
})
export class UploadsModule {}
