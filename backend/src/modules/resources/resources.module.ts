import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { ResourcesController } from "./resources.controller";

@Module({
  imports: [PrismaModule],
  controllers: [ResourcesController]
})
export class ResourcesModule {}
