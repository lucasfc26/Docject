import { PrismaService } from "../../prisma/prisma.service";

type BillableService = {
  id: string;
  name: string;
  monthlyValue: unknown;
  paymentDay: number;
  startDate: Date;
  active: boolean;
  client: { name: string };
};

const SYNC_THROTTLE_MS = 60_000;
let lastSyncAt = 0;
let inflightSync: Promise<void> | null = null;

/**
 * Creates the pending revenue entries of every active service that are already due.
 * Called from several GET endpoints, so it runs at most once per minute and concurrent
 * requests share the run in progress.
 */
export function syncDueServicePayments(prisma: PrismaService) {
  if (inflightSync) return inflightSync;
  if (Date.now() - lastSyncAt < SYNC_THROTTLE_MS) return Promise.resolve();
  inflightSync = runSyncDueServicePayments(prisma)
    .then(() => {
      lastSyncAt = Date.now();
    })
    .finally(() => {
      inflightSync = null;
    });
  return inflightSync;
}

async function runSyncDueServicePayments(prisma: PrismaService) {
  const services = await prisma.service.findMany({
    where: { active: true },
    include: { client: true }
  });
  if (!services.length) return;
  const existing = await prisma.financialTransaction.findMany({
    where: { serviceId: { in: services.map((service) => service.id) }, servicePeriod: { not: null } },
    select: { serviceId: true, servicePeriod: true }
  });
  const known = new Set(existing.map((item) => `${item.serviceId}|${item.servicePeriod}`));
  const today = startOfDay(new Date());
  const data = services.flatMap((service) =>
    duePayments(service, today).filter((payment) => !known.has(`${service.id}|${payment.servicePeriod}`))
  );
  if (data.length) await prisma.financialTransaction.createMany({ data, skipDuplicates: true });
}

export async function syncOneServicePayments(prisma: PrismaService, serviceId: string) {
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    include: { client: true }
  });
  if (!service) return;
  const data = duePayments(service, startOfDay(new Date()));
  if (data.length) await prisma.financialTransaction.createMany({ data, skipDuplicates: true });
}

function duePayments(service: BillableService, today: Date) {
  const start = new Date(service.startDate.getFullYear(), service.startDate.getMonth(), 1);
  const serviceStart = beginningOfDay(service.startDate);
  const cursor = new Date(start);
  const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const payments: Array<{
    entity: string;
    kind: string;
    amount: number;
    status: "PENDING";
    dueDate: Date;
    serviceId: string;
    servicePeriod: string;
  }> = [];

  while (cursor <= currentMonth) {
    const dueDate = serviceDueDate(cursor.getFullYear(), cursor.getMonth(), service.paymentDay);
    if (dueDate >= serviceStart && dueDate <= today) {
      const servicePeriod = periodKey(cursor);
      payments.push({
        entity: `${service.client.name} - ${service.name} - ${servicePeriod}`,
        kind: "REVENUE",
        amount: Number(service.monthlyValue),
        status: "PENDING",
        dueDate,
        serviceId: service.id,
        servicePeriod
      });
    }
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return payments;
}

export function serviceDueDate(year: number, month: number, paymentDay: number) {
  const lastDay = new Date(year, month + 1, 0).getDate();
  const requestedDay = Math.min(paymentDay, lastDay);
  const dueDate = new Date(year, month, requestedDay);
  dueDate.setHours(9, 0, 0, 0);

  if (paymentDay > lastDay) return previousBusinessDay(dueDate);
  return nextBusinessDay(dueDate);
}

function nextBusinessDay(date: Date) {
  const next = new Date(date);
  while (next.getDay() === 0 || next.getDay() === 6) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

function previousBusinessDay(date: Date) {
  const previous = new Date(date);
  while (previous.getDay() === 0 || previous.getDay() === 6) {
    previous.setDate(previous.getDate() - 1);
  }
  return previous;
}

function periodKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

function beginningOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}
