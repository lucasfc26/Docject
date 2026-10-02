import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { buildServiceHours } from "./services.hours";

export const HEALTH_SAMPLE_INTERVAL_MINUTES = 15;
export const HEALTH_SAMPLE_RETENTION_MONTHS = 3;
const DEFAULT_TIMEZONE = "America/Fortaleza";

export const BACKUP_STATUSES = ["OK", "ATTENTION", "FAILED", "NOT_APPLICABLE"] as const;
export type BackupStatus = (typeof BACKUP_STATUSES)[number];

type Sample = {
  checkKey: string;
  checkName: string;
  online: boolean;
  responseTimeMs: number | null;
  summary: string | null;
  components: Prisma.JsonValue;
  checkedAt: Date;
};

type CheckAvailability = {
  checkKey: string;
  checkName: string;
  samplesTotal: number;
  samplesOnline: number;
  availabilityPercent: number | null;
  downtimeMinutes: number;
  avgResponseMs: number | null;
};

type AutoIncident = {
  checkName: string;
  startedAt: string;
  endedAt: string | null;
  durationMinutes: number;
  summary: string | null;
};

type BackupSummary = {
  samplesTotal: number;
  samplesOk: number;
  lastDetail: string | null;
  lastCheckedAt: string | null;
  autoStatus: BackupStatus | null;
};

type MonitoringSnapshot = {
  availabilityPercent: number | null;
  samplesTotal: number;
  samplesOnline: number;
  monitoring: CheckAvailability[];
  autoIncidents: AutoIncident[];
  backupSummary: BackupSummary | null;
};

type ReportService = {
  id: string;
  name: string;
  startDate: Date;
  monthlyHours: Prisma.Decimal;
  hoursExpirePercent: number;
  hoursExpirationMonths: number;
  client?: { name: string } | null;
};

export async function systemTimezone(prisma: PrismaService) {
  const settings = await prisma.systemSettings.findUnique({ where: { id: "system" }, select: { timezone: true } });
  return isValidTimezone(settings?.timezone) ? settings!.timezone : DEFAULT_TIMEZONE;
}

/** Months (YYYY-MM) from the service start until the current month, newest first. */
export function reportMonths(startDate: Date, timeZone: string, now = new Date()) {
  const first = monthKeyInZone(startDate, timeZone);
  const last = monthKeyInZone(now, timeZone);
  const months: string[] = [];
  for (let month = last; month >= first; month = shiftMonth(month, -1)) months.push(month);
  return months;
}

export async function buildMonitoringSnapshot(
  prisma: PrismaService,
  serviceId: string,
  month: string,
  timeZone: string
): Promise<MonitoringSnapshot> {
  const { start, end } = monthRange(month, timeZone);
  const samples = await prisma.serviceHealthSample.findMany({
    where: { serviceId, checkedAt: { gte: start, lt: end } },
    orderBy: { checkedAt: "asc" }
  });
  return summarizeSamples(samples);
}

export function summarizeSamples(samples: Sample[]): MonitoringSnapshot {
  const byCheck = new Map<string, Sample[]>();
  for (const sample of samples) {
    const list = byCheck.get(sample.checkKey) ?? [];
    list.push(sample);
    byCheck.set(sample.checkKey, list);
  }

  const monitoring: CheckAvailability[] = [];
  const autoIncidents: AutoIncident[] = [];
  for (const [checkKey, list] of byCheck) {
    const online = list.filter((sample) => sample.online);
    const responseTimes = online.map((sample) => sample.responseTimeMs).filter((value): value is number => value != null);
    const checkName = list[list.length - 1].checkName;
    monitoring.push({
      checkKey,
      checkName,
      samplesTotal: list.length,
      samplesOnline: online.length,
      availabilityPercent: percent(online.length, list.length),
      downtimeMinutes: (list.length - online.length) * HEALTH_SAMPLE_INTERVAL_MINUTES,
      avgResponseMs: responseTimes.length ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) : null
    });
    autoIncidents.push(...detectIncidents(checkName, list));
  }

  const samplesOnline = samples.filter((sample) => sample.online).length;
  return {
    availabilityPercent: percent(samplesOnline, samples.length),
    samplesTotal: samples.length,
    samplesOnline,
    monitoring: monitoring.sort((a, b) => a.checkName.localeCompare(b.checkName)),
    autoIncidents: autoIncidents.sort((a, b) => a.startedAt.localeCompare(b.startedAt)),
    backupSummary: summarizeBackups(samples)
  };
}

/** Consecutive offline samples of a check become one incident, closed by the next online sample. */
function detectIncidents(checkName: string, samples: Sample[]): AutoIncident[] {
  const incidents: AutoIncident[] = [];
  let openSince: Sample | null = null;
  let offlineCount = 0;
  for (const sample of samples) {
    if (!sample.online) {
      if (!openSince) openSince = sample;
      offlineCount += 1;
      continue;
    }
    if (openSince) {
      incidents.push(incident(checkName, openSince, sample.checkedAt, offlineCount));
      openSince = null;
      offlineCount = 0;
    }
  }
  if (openSince) incidents.push(incident(checkName, openSince, null, offlineCount));
  return incidents;
}

function incident(checkName: string, first: Sample, endedAt: Date | null, offlineCount: number): AutoIncident {
  const durationMinutes = endedAt
    ? Math.max(HEALTH_SAMPLE_INTERVAL_MINUTES, Math.round((endedAt.getTime() - first.checkedAt.getTime()) / 60000))
    : offlineCount * HEALTH_SAMPLE_INTERVAL_MINUTES;
  return {
    checkName,
    startedAt: first.checkedAt.toISOString(),
    endedAt: endedAt?.toISOString() ?? null,
    durationMinutes,
    summary: first.summary
  };
}

function summarizeBackups(samples: Sample[]): BackupSummary | null {
  const backups = samples
    .map((sample) => ({ sample, component: findComponent(sample.components, "Backups") }))
    .filter((item): item is { sample: Sample; component: { online: boolean; detail: string | undefined } } => Boolean(item.component));
  if (!backups.length) return null;
  const samplesOk = backups.filter((item) => item.component.online).length;
  const last = backups[backups.length - 1];
  const autoStatus: BackupStatus = !last.component.online || samplesOk === 0 ? "FAILED" : samplesOk < backups.length ? "ATTENTION" : "OK";
  return {
    samplesTotal: backups.length,
    samplesOk,
    lastDetail: last.component.detail ?? null,
    lastCheckedAt: last.sample.checkedAt.toISOString(),
    autoStatus
  };
}

function findComponent(value: Prisma.JsonValue, name: string) {
  if (!Array.isArray(value)) return undefined;
  for (const item of value) {
    if (item && typeof item === "object" && !Array.isArray(item) && item.name === name) {
      return { online: Boolean(item.online), detail: typeof item.detail === "string" ? item.detail : undefined };
    }
  }
  return undefined;
}

/** Freezes the monitoring numbers of a finished month, since raw samples are pruned later. */
export async function closeMonthlyReport(prisma: PrismaService, serviceId: string, month: string, timeZone: string) {
  const snapshot = await buildMonitoringSnapshot(prisma, serviceId, month, timeZone);
  const data = {
    availabilityPercent: snapshot.availabilityPercent,
    samplesTotal: snapshot.samplesTotal,
    samplesOnline: snapshot.samplesOnline,
    monitoring: snapshot.monitoring as unknown as Prisma.InputJsonValue,
    autoIncidents: snapshot.autoIncidents as unknown as Prisma.InputJsonValue,
    backupSummary: (snapshot.backupSummary ?? Prisma.DbNull) as Prisma.InputJsonValue,
    closedAt: new Date()
  };
  await prisma.serviceMonthlyReport.upsert({
    where: { serviceId_month: { serviceId, month } },
    create: { serviceId, month, ...data },
    update: data
  });
}

export async function buildMonthlyReport(prisma: PrismaService, service: ReportService, month: string, timeZone: string) {
  const stored = await prisma.serviceMonthlyReport.findUnique({
    where: { serviceId_month: { serviceId: service.id, month } },
    include: { updatedBy: { select: { id: true, name: true } } }
  });
  const snapshot: MonitoringSnapshot = stored?.closedAt
    ? {
        availabilityPercent: stored.availabilityPercent,
        samplesTotal: stored.samplesTotal,
        samplesOnline: stored.samplesOnline,
        monitoring: stored.monitoring as unknown as CheckAvailability[],
        autoIncidents: stored.autoIncidents as unknown as AutoIncident[],
        backupSummary: (stored.backupSummary as unknown as BackupSummary | null) ?? null
      }
    : await buildMonitoringSnapshot(prisma, service.id, month, timeZone);

  const logs = await prisma.serviceWorkLog.findMany({
    where: { serviceId: service.id },
    include: { createdBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" }
  });
  const hoursMonth = buildServiceHours(service, logs).find((item) => item.month === month);
  const manualBackup = isBackupStatus(stored?.backupStatus) ? stored!.backupStatus : null;

  return {
    serviceId: service.id,
    serviceName: service.name,
    clientName: service.client?.name ?? null,
    month,
    status: stored?.closedAt ? "CLOSED" : "OPEN",
    closedAt: stored?.closedAt ?? null,
    updatedAt: stored?.updatedAt ?? null,
    updatedBy: stored?.updatedBy ?? null,
    availability: {
      percent: snapshot.availabilityPercent,
      samplesTotal: snapshot.samplesTotal,
      samplesOnline: snapshot.samplesOnline,
      intervalMinutes: HEALTH_SAMPLE_INTERVAL_MINUTES,
      checks: snapshot.monitoring
    },
    incidents: {
      auto: snapshot.autoIncidents,
      notes: stored?.incidentNotes ?? null
    },
    backup: {
      status: manualBackup ?? snapshot.backupSummary?.autoStatus ?? null,
      manualStatus: manualBackup,
      summary: snapshot.backupSummary,
      notes: stored?.backupNotes ?? null
    },
    hours: {
      monthlyHours: hoursMonth?.monthlyHours ?? Number(service.monthlyHours ?? 0),
      usedHours: hoursMonth?.usedHours ?? 0,
      availableHours: hoursMonth?.availableHours ?? 0,
      remainingHours: hoursMonth?.remainingHours ?? 0,
      overageHours: hoursMonth?.overageHours ?? 0,
      logs: hoursMonth?.logs ?? []
    },
    carriedHours: {
      hours: hoursMonth?.carriedHours ?? 0,
      expiredHours: hoursMonth?.expiredHours ?? 0,
      cohorts: (hoursMonth?.cohorts ?? []).filter((cohort) => cohort.originMonth !== month)
    },
    otherOccurrences: stored?.otherOccurrences ?? null
  };
}

export function isBackupStatus(value: unknown): value is BackupStatus {
  return typeof value === "string" && (BACKUP_STATUSES as readonly string[]).includes(value);
}

export function monthKeyInZone(date: Date, timeZone: string) {
  const parts = zonedParts(date, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}`;
}

export function shiftMonth(month: string, amount: number) {
  const [year, value] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, value - 1 + amount, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthRange(month: string, timeZone: string) {
  return { start: zonedMonthStart(month, timeZone), end: zonedMonthStart(shiftMonth(month, 1), timeZone) };
}

function zonedMonthStart(month: string, timeZone: string) {
  const [year, value] = month.split("-").map(Number);
  const guess = Date.UTC(year, value - 1, 1);
  const offset = zonedOffsetMs(new Date(guess), timeZone);
  const result = new Date(guess - offset);
  // Re-check once in case the offset changes across the boundary (DST).
  const corrected = zonedOffsetMs(result, timeZone);
  return corrected === offset ? result : new Date(guess - corrected);
}

function zonedOffsetMs(date: Date, timeZone: string) {
  const parts = zonedParts(date, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

function zonedParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
  const values: Record<string, number> = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") values[part.type] = Number(part.value);
  }
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second
  };
}

function isValidTimezone(value?: string | null) {
  if (!value) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function percent(part: number, total: number) {
  return total ? Math.round((part / total) * 10000) / 100 : null;
}
