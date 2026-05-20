import { Controller, Get, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AuthenticatedRequest } from "../../common/current-user";
import { PrismaService } from "../../prisma/prisma.service";

@ApiTags("features")
@Controller("features")
export class FeaturesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  findAll(@Req() request: AuthenticatedRequest) {
    const role = request.user?.role ?? "CLIENT";
    return this.prisma.feature.findMany({
      where: role === "CLIENT" ? { role: "CLIENT" } : {},
      orderBy: { orderIndex: "asc" }
    });
  }
}
