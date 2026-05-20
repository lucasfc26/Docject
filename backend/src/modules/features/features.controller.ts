import { Controller, Get, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AuthenticatedRequest } from "../../common/current-user";
import { PrismaService } from "../../prisma/prisma.service";

@ApiTags("features")
@Controller("features")
export class FeaturesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async findAll(@Req() request: AuthenticatedRequest) {
    const role = request.user?.role ?? "CLIENT";
    const paths = featurePathsByRole[role] ?? featurePathsByRole.CLIENT;
    const records = await this.prisma.feature.findMany({
      where: { path: { in: paths } },
      orderBy: { orderIndex: "asc" }
    });
    const byPath = new Map(records.map((item) => [item.path, item]));
    return paths.map((path, index) => byPath.get(path) ?? { id: path, name: fallbackFeatureNames[path] ?? path, path, orderIndex: index + 1, role });
  }
}

const featurePathsByRole: Record<string, string[]> = {
  ADMIN: ["/dashboard", "/clients", "/projects", "/services", "/contracts", "/financial", "/agenda", "/resources", "/settings"],
  MANAGER: ["/dashboard", "/clients", "/projects", "/services", "/contracts", "/financial", "/agenda", "/resources", "/settings"],
  FINANCIAL: ["/dashboard", "/financial", "/settings"],
  CLIENT: ["/client/dashboard", "/settings"]
};

const fallbackFeatureNames: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/clients": "Clientes",
  "/projects": "Projetos",
  "/services": "Servicos",
  "/contracts": "Contratos",
  "/financial": "Financeiro",
  "/agenda": "Agenda",
  "/resources": "Recursos",
  "/client/dashboard": "Portal Cliente",
  "/settings": "Configuracoes"
};
