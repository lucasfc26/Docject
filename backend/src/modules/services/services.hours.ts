type HoursConfig = {
  monthlyHours: unknown;
  hoursExpirePercent: number;
  hoursExpirationMonths: number;
  startDate: Date;
};

type WorkLog = {
  id: string;
  month: string;
  hours: unknown;
  description: string;
  createdAt: Date;
  createdBy?: { id: string; name: string } | null;
};

type Cohort = { originMonth: string; hours: number };

export type ServiceHoursMonth = {
  month: string;
  monthlyHours: number;
  carriedHours: number;
  expiredHours: number;
  availableHours: number;
  usedHours: number;
  remainingHours: number;
  overageHours: number;
  cohorts: Cohort[];
  logs: Array<Omit<WorkLog, "hours"> & { hours: number }>;
};

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const EPSILON = 0.0001;

export function isValidMonth(value: string) {
  return MONTH_PATTERN.test(value);
}

/**
 * Builds the monthly hours bank. Each month grants `monthlyHours` as a new cohort.
 * When a month turns, every unused cohort loses `hoursExpirePercent` of its balance and
 * cohorts older than `hoursExpirationMonths` (0 = never) are dropped. Logged hours consume
 * the oldest cohorts first, since those expire sooner.
 */
export function buildServiceHours(service: HoursConfig, logs: WorkLog[], today = new Date()): ServiceHoursMonth[] {
  const monthlyHours = Math.max(0, Number(service.monthlyHours ?? 0));
  const keepRatio = 1 - clamp(service.hoursExpirePercent ?? 0, 0, 100) / 100;
  const expirationMonths = Math.max(0, service.hoursExpirationMonths ?? 0);

  const logMonths = logs.map((log) => log.month).filter(isValidMonth).sort();
  const startMonth = minMonth(monthKey(service.startDate), logMonths[0]);
  const endMonth = maxMonth(monthKey(today), logMonths[logMonths.length - 1]);

  const logsByMonth = new Map<string, WorkLog[]>();
  for (const log of logs) {
    const list = logsByMonth.get(log.month) ?? [];
    list.push(log);
    logsByMonth.set(log.month, list);
  }

  const months: ServiceHoursMonth[] = [];
  let cohorts: Cohort[] = [];

  for (let month = startMonth; month <= endMonth; month = addMonths(month, 1)) {
    let expiredHours = 0;
    const carried: Cohort[] = [];
    for (const cohort of cohorts) {
      const decayed = cohort.hours * keepRatio;
      expiredHours += cohort.hours - decayed;
      const age = monthDiff(cohort.originMonth, month);
      if (expirationMonths > 0 && age >= expirationMonths) {
        expiredHours += decayed;
        continue;
      }
      if (decayed > EPSILON) carried.push({ originMonth: cohort.originMonth, hours: decayed });
    }

    const monthCohorts = [...carried];
    if (monthlyHours > 0) monthCohorts.push({ originMonth: month, hours: monthlyHours });
    const carriedHours = sum(carried.map((cohort) => cohort.hours));
    const availableHours = carriedHours + (monthlyHours > 0 ? monthlyHours : 0);

    const monthLogs = (logsByMonth.get(month) ?? []).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const usedHours = sum(monthLogs.map((log) => Number(log.hours)));

    let toConsume = usedHours;
    const remaining: Cohort[] = [];
    for (const cohort of monthCohorts) {
      const consumed = Math.min(cohort.hours, toConsume);
      toConsume -= consumed;
      const left = cohort.hours - consumed;
      if (left > EPSILON) remaining.push({ originMonth: cohort.originMonth, hours: left });
    }

    months.push({
      month,
      monthlyHours,
      carriedHours: round(carriedHours),
      expiredHours: round(expiredHours),
      availableHours: round(availableHours),
      usedHours: round(usedHours),
      remainingHours: round(sum(remaining.map((cohort) => cohort.hours))),
      overageHours: round(Math.max(0, toConsume)),
      cohorts: monthCohorts.map((cohort) => ({ originMonth: cohort.originMonth, hours: round(cohort.hours) })),
      logs: monthLogs.map((log) => ({ ...log, hours: Number(log.hours) }))
    });
    cohorts = remaining;
  }

  return months.reverse();
}

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function addMonths(month: string, amount: number) {
  const [year, value] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, value - 1 + amount, 1));
  return monthKey(date);
}

function monthDiff(from: string, to: string) {
  const [fromYear, fromMonth] = from.split("-").map(Number);
  const [toYear, toMonth] = to.split("-").map(Number);
  return (toYear - fromYear) * 12 + (toMonth - fromMonth);
}

function minMonth(base: string, other?: string) {
  return other && other < base ? other : base;
}

function maxMonth(base: string, other?: string) {
  return other && other > base ? other : base;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
