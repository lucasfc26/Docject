import { Controller, Get, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AuthenticatedRequest, clientScope, projectScope } from "../../common/current-user";
import { PrismaService } from "../../prisma/prisma.service";
import { syncDueServicePayments } from "../services/services.billing";

@ApiTags("dashboard")
@Controller("dashboard")
export class DashboardController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async overview(@Req() request: AuthenticatedRequest) {
    await syncDueServicePayments(this.prisma);
    const [clients, projects, contracts, notifications, financial] = await Promise.all([
      this.prisma.client.count({ where: clientScope(request.user) }),
      this.prisma.project.findMany({ where: projectScope(request.user), include: { client: true, modules: true } }),
      this.prisma.contract.count(),
      this.prisma.notification.findMany({ where: { read: false }, take: 6, orderBy: { createdAt: "desc" } }),
      this.prisma.financialTransaction.findMany()
    ]);

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const previousMonthDate = new Date(currentYear, currentMonth - 1, 1);
    const currentMonthRevenue = revenueForPeriod(financial, (date) => date.getFullYear() === currentYear && date.getMonth() === currentMonth);
    const previousMonthRevenue = revenueForPeriod(financial, (date) => date.getFullYear() === previousMonthDate.getFullYear() && date.getMonth() === previousMonthDate.getMonth());
    const currentYearRevenue = revenueForPeriod(financial, (date) => date.getFullYear() === currentYear);
    const previousYearRevenue = revenueForPeriod(financial, (date) => date.getFullYear() === currentYear - 1);
    const activeProjects = projects.filter((item) => item.status !== "COMPLETED" && item.status !== "CANCELLED").length;
    const projectsWithProgress = projects.map((project) => ({ ...project, progress: moduleProgress(project.modules) }));
    const averageProgress = projectsWithProgress.length ? Math.round(projectsWithProgress.reduce((sum, item) => sum + item.progress, 0) / projectsWithProgress.length) : 0;

    return {
      kpis: {
        clients,
        activeProjects,
        contracts,
        revenueMonth: currentMonthRevenue,
        revenueMonthChange: percentageChange(currentMonthRevenue, previousMonthRevenue),
        revenueYear: currentYearRevenue,
        revenueYearChange: percentageChange(currentYearRevenue, previousYearRevenue),
        averageProgress
      },
      projects: projectsWithProgress,
      notifications
    };
  }
}

function revenueForPeriod(
  transactions: Array<{ amount: unknown; kind: string; status: string; dueDate: Date | null; createdAt: Date }>,
  inPeriod: (date: Date) => boolean
) {
  return transactions
    .filter((item) => {
      const paidDate = item.dueDate ?? item.createdAt;
      return item.status === "PAID" && item.kind === "REVENUE" && inPeriod(paidDate);
    })
    .reduce((sum, item) => sum + Math.abs(Number(item.amount)), 0);
}

function percentageChange(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function moduleProgress(modules: Array<{ completed: boolean; progress: number }>) {
  if (!modules.length) return 0;
  const completed = modules.filter((module) => module.completed || module.progress >= 100).length;
  return Math.round((completed / modules.length) * 100);
}
