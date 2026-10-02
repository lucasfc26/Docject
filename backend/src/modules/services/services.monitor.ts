import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { checkServiceHealth, sanitizeHealthChecks } from "./services.health";
import {
  HEALTH_SAMPLE_INTERVAL_MINUTES,
  HEALTH_SAMPLE_RETENTION_MONTHS,
  closeMonthlyReport,
  monthKeyInZone,
  monthRange,
  shiftMonth,
  systemTimezone
} from "./services.reports";

const FIRST_RUN_DELAY_MS = 30_000;

/**
 * Samples every service health check on a fixed interval, closes the previous month's
 * report once the month is over and prunes samples older than the retention window.
 */
@Injectable()
export class ServiceMonitorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ServiceMonitorService.name);
  private timer?: NodeJS.Timeout;
  private firstRun?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    if (process.env.SERVICE_MONITOR_DISABLED === "true") return;
    this.firstRun = setTimeout(() => void this.tick(), FIRST_RUN_DELAY_MS);
    this.timer = setInterval(() => void this.tick(), HEALTH_SAMPLE_INTERVAL_MINUTES * 60_000);
  }

  onModuleDestroy() {
    if (this.firstRun) clearTimeout(this.firstRun);
    if (this.timer) clearInterval(this.timer);
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const timeZone = await systemTimezone(this.prisma);
      await this.collectSamples();
      await this.closePreviousMonth(timeZone);
      await this.pruneSamples(timeZone);
    } catch (error) {
      this.logger.error("Falha no monitoramento de servicos", error instanceof Error ? error.stack : String(error));
    } finally {
      this.running = false;
    }
  }

  private async collectSamples() {
    const services = await this.prisma.service.findMany({
      where: { active: true },
      select: { id: true, healthChecks: true }
    });
    const checkedAt = new Date();
    for (const service of services) {
      const checks = sanitizeHealthChecks(service.healthChecks);
      if (!checks.length) continue;
      const results = await Promise.all(checks.map(checkServiceHealth));
      await this.prisma.serviceHealthSample.createMany({
        data: results.map((result) => ({
          serviceId: service.id,
          checkKey: result.id || `${result.name}|${result.address}`,
          checkName: result.name,
          online: result.online,
          status: result.status,
          responseTimeMs: result.responseTimeMs,
          summary: result.summary,
          components: result.components as unknown as Prisma.InputJsonValue,
          checkedAt
        }))
      });
    }
  }

  private async closePreviousMonth(timeZone: string) {
    const previousMonth = shiftMonth(monthKeyInZone(new Date(), timeZone), -1);
    const { end } = monthRange(previousMonth, timeZone);
    const services = await this.prisma.service.findMany({
      where: {
        startDate: { lt: end },
        monthlyReports: { none: { month: previousMonth, closedAt: { not: null } } }
      },
      select: { id: true }
    });
    for (const service of services) {
      await closeMonthlyReport(this.prisma, service.id, previousMonth, timeZone);
    }
  }

  private async pruneSamples(timeZone: string) {
    const oldestKept = shiftMonth(monthKeyInZone(new Date(), timeZone), -HEALTH_SAMPLE_RETENTION_MONTHS);
    const { start } = monthRange(oldestKept, timeZone);
    await this.prisma.serviceHealthSample.deleteMany({ where: { checkedAt: { lt: start } } });
  }
}
