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

export async function syncDueServicePayments(prisma: PrismaService) {
  const services = await prisma.service.findMany({
    where: { active: true },
    include: { client: true }
  });
  const today = startOfDay(new Date());

  for (const service of services) {
    await syncServicePayments(prisma, service, today);
  }
}

export async function syncOneServicePayments(prisma: PrismaService, serviceId: string) {
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    include: { client: true }
  });
  if (service) await syncServicePayments(prisma, service, startOfDay(new Date()));
}

async function syncServicePayments(prisma: PrismaService, service: BillableService, today: Date) {
  const start = new Date(service.startDate.getFullYear(), service.startDate.getMonth(), 1);
  const serviceStart = beginningOfDay(service.startDate);
  const cursor = new Date(start);
  const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  while (cursor <= currentMonth) {
    const dueDate = serviceDueDate(cursor.getFullYear(), cursor.getMonth(), service.paymentDay);
    if (dueDate >= serviceStart && dueDate <= today) {
      const servicePeriod = periodKey(cursor);
      const existing = await prisma.financialTransaction.findUnique({
        where: { serviceId_servicePeriod: { serviceId: service.id, servicePeriod } }
      });

      if (!existing) {
        await prisma.financialTransaction.create({
          data: {
          entity: `${service.client.name} - ${service.name} - ${servicePeriod}`,
          kind: "REVENUE",
          amount: Number(service.monthlyValue),
          status: "PENDING",
          dueDate,
          serviceId: service.id,
          servicePeriod
          }
        });
      }
    }
    cursor.setMonth(cursor.getMonth() + 1);
  }
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
