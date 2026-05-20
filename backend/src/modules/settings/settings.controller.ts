import { Body, Controller, Get, Patch } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { PrismaService } from "../../prisma/prisma.service";
import { UpdateSettingsDto } from "./dto/settings.dto";

@ApiTags("settings")
@Controller("settings")
export class SettingsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  getSettings() {
    return this.prisma.systemSettings.upsert({
      where: { id: "system" },
      update: {},
      create: { id: "system", appName: "Docject", timezone: "America/Fortaleza", currency: "BRL" }
    });
  }

  @Patch()
  updateSettings(@Body() body: UpdateSettingsDto) {
    return this.prisma.systemSettings.upsert({
      where: { id: "system" },
      update: body,
      create: { id: "system", appName: body.appName ?? "Docject", timezone: body.timezone ?? "America/Fortaleza", currency: body.currency ?? "BRL", supportPhone: body.supportPhone }
    });
  }
}
