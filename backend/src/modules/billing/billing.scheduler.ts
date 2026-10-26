import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { syncDueServicePayments } from "../services/services.billing";
import { BillingService } from "./billing.service";

const FIRST_RUN_DELAY_MS = 60_000;
const INTERVAL_MS = 60 * 60_000;

/** Hourly pass that issues the Asaas charges of admins with automatic billing enabled. */
@Injectable()
export class BillingScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BillingScheduler.name);
  private timer?: NodeJS.Timeout;
  private firstRun?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: BillingService,
  ) {}

  onModuleInit() {
    if (process.env.BILLING_AUTO_CHARGE_DISABLED === "true") return;
    this.firstRun = setTimeout(() => void this.tick(), FIRST_RUN_DELAY_MS);
    this.timer = setInterval(() => void this.tick(), INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.firstRun) clearTimeout(this.firstRun);
    if (this.timer) clearInterval(this.timer);
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await syncDueServicePayments(this.prisma);
      await this.billing.runAutoCharge();
    } catch (error) {
      this.logger.error("Falha na cobranca automatica", error instanceof Error ? error.stack : String(error));
    } finally {
      this.running = false;
    }
  }
}
