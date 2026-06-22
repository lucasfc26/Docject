import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { clientScope, contractScope, CurrentUser, projectScope } from "../../common/current-user";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(user: CurrentUser | undefined, query: string, limit = 5) {
    const term = query.trim();
    if (term.length < 2) {
      return { clients: [], projects: [], contracts: [] };
    }

    const take = Math.min(Math.max(limit, 1), 10);
    const contains = { contains: term, mode: "insensitive" as const };

    const [clients, projects, contracts] = await Promise.all([
      this.searchClients(user, contains, take),
      this.searchProjects(user, contains, take),
      this.searchContracts(user, contains, term, take),
    ]);

    return { clients, projects, contracts };
  }

  private searchClients(user: CurrentUser | undefined, contains: Prisma.StringFilter, take: number) {
    if (user?.role === "CLIENT") return [];
    return this.prisma.client.findMany({
      where: {
        ...clientScope(user),
        OR: [{ name: contains }, { document: contains }, { cpf: contains }, { segment: contains }],
      },
      select: { id: true, name: true, segment: true, document: true },
      take,
      orderBy: { name: "asc" },
    });
  }

  private searchProjects(user: CurrentUser | undefined, contains: Prisma.StringFilter, take: number) {
    if (user?.role === "FINANCIAL") return [];
    return this.prisma.project.findMany({
      where: {
        ...projectScope(user),
        OR: [{ name: contains }, { client: { name: contains } }],
      },
      select: {
        id: true,
        name: true,
        status: true,
        client: { select: { name: true } },
      },
      take,
      orderBy: { name: "asc" },
    });
  }

  private async searchContracts(
    user: CurrentUser | undefined,
    contains: Prisma.StringFilter,
    term: string,
    take: number
  ) {
    if (user?.role === "FINANCIAL") return [];
    const idFilter = term.length >= 8 ? [{ id: { contains: term, mode: "insensitive" as const } }] : [];
    return this.prisma.contract.findMany({
      where: {
        ...contractScope(user),
        OR: [{ title: contains }, ...idFilter],
      },
      select: {
        id: true,
        title: true,
        status: true,
        client: { select: { name: true } },
      },
      take,
      orderBy: { updatedAt: "desc" },
    });
  }
}
