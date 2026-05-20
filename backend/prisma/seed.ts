import { PrismaClient, ProjectStatus, ContractStatus, TransactionStatus, UserRole } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("projectfy", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@projectfy.io" },
    update: {},
    create: {
      email: "admin@projectfy.io",
      name: "Admin Docject",
      passwordHash,
      role: UserRole.ADMIN
    }
  });

  const alpha = await prisma.client.upsert({
    where: { id: "cli_alpha" },
    update: { ownerId: admin.id },
    create: {
      id: "cli_alpha",
      name: "Alpha Core",
      segment: "Enterprise",
      health: "EXCELLENT",
      revenue: 1200000,
      ownerId: admin.id,
      contacts: {
        create: [{ name: "Elena R.", email: "elena@alphacore.test", phone: "+55 85 90000-0001" }]
      }
    }
  });

  const omega = await prisma.client.upsert({
    where: { id: "cli_omega" },
    update: { ownerId: admin.id },
    create: {
      id: "cli_omega",
      name: "Omega Corp",
      segment: "Cloud",
      health: "ATTENTION",
      revenue: 420000,
      ownerId: admin.id,
      contacts: {
        create: [{ name: "Marcus T.", email: "marcus@omega.test" }]
      }
    }
  });

  await prisma.project.upsert({
    where: { id: "prj_0042" },
    update: {},
    create: {
      id: "prj_0042",
      name: "Quantum Nexus Rewrite",
      budget: 1200000,
      status: ProjectStatus.IN_PROGRESS,
      progress: 75,
      clientId: alpha.id,
      modules: {
        create: [
          { name: "Discovery", progress: 100, milestones: { create: [{ title: "Kickoff", completed: true }] } },
          { name: "Delivery Sprint", progress: 68, milestones: { create: [{ title: "Beta Release V1", dueDate: new Date("2026-12-05") }] } }
        ]
      }
    }
  });

  await prisma.project.upsert({
    where: { id: "prj_0043" },
    update: {},
    create: {
      id: "prj_0043",
      name: "Docject Storage V2",
      budget: 420000,
      status: ProjectStatus.WAITING_CLIENT,
      progress: 42,
      clientId: omega.id
    }
  });

  await prisma.contract.upsert({
    where: { id: "ctr_alpha_msa" },
    update: { clientId: alpha.id },
    create: {
      id: "ctr_alpha_msa",
      title: "MSA Alpha Core",
      value: 780000,
      status: ContractStatus.SIGNED,
      clientId: alpha.id,
      versions: { create: [{ version: 3, fileUrl: "/uploads/msa-alpha-v3.pdf" }] }
    }
  });

  await prisma.contract.upsert({
    where: { id: "ctr_storage_sow" },
    update: { clientId: omega.id },
    create: {
      id: "ctr_storage_sow",
      title: "SOW Storage V2",
      value: 420000,
      status: ContractStatus.SENT,
      clientId: omega.id,
      versions: { create: [{ version: 1, fileUrl: "/uploads/sow-storage-v1.pdf" }] }
    }
  });

  await prisma.financialTransaction.createMany({
    data: [
      { id: "trx_9012", entity: "Omega Corp Solutions", amount: 145000, status: TransactionStatus.PAID, kind: "REVENUE" },
      { id: "trx_9013", entity: "Alpha Core", amount: 85000, status: TransactionStatus.PENDING, kind: "REVENUE", dueDate: new Date("2026-11-18") },
      { id: "trx_9014", entity: "Infra Cloud", amount: -22400, status: TransactionStatus.PENDING, kind: "EXPENSE", dueDate: new Date("2026-11-20") }
    ],
    skipDuplicates: true
  });

  await prisma.appointment.createMany({
    data: [
      { id: "apt_sprint_review", title: "Sprint Review", client: "Alpha Core", location: "Meet", startsAt: new Date("2026-11-20T13:00:00.000Z"), endsAt: new Date("2026-11-20T14:00:00.000Z"), notes: "Revisar entregas da sprint e bloqueios." },
      { id: "apt_finance_sync", title: "Finance Sync", client: "Omega Corp", location: "Meet", startsAt: new Date("2026-11-23T17:00:00.000Z"), endsAt: new Date("2026-11-23T17:45:00.000Z"), notes: "Alinhar pagamentos e proximas faturas." }
    ],
    skipDuplicates: true
  });

  await prisma.notification.createMany({
    data: [
      { id: "not_contract_sent", type: "CONTRACT_SENT", title: "Contrato enviado para Alpha Core" },
      { id: "not_payment_due", type: "PAYMENT_DUE", title: "Pagamento vence amanhã" }
    ],
    skipDuplicates: true
  });

  await prisma.systemSettings.upsert({
    where: { id: "system" },
    update: {},
    create: { id: "system", appName: "Docject", timezone: "America/Fortaleza", currency: "BRL" }
  });

  const features = [
    { name: "Dashboard", path: "/dashboard", orderIndex: 1, role: UserRole.ADMIN },
    { name: "Clientes", path: "/clients", orderIndex: 2, role: UserRole.ADMIN },
    { name: "Projetos", path: "/projects", orderIndex: 3, role: UserRole.ADMIN },
    { name: "Servicos", path: "/services", orderIndex: 4, role: UserRole.ADMIN },
    { name: "Contratos", path: "/contracts", orderIndex: 5, role: UserRole.ADMIN },
    { name: "Financeiro", path: "/financial", orderIndex: 6, role: UserRole.ADMIN },
    { name: "Agenda", path: "/agenda", orderIndex: 7, role: UserRole.ADMIN },
    { name: "Recursos", path: "/resources", orderIndex: 8, role: UserRole.ADMIN },
    { name: "Portal Cliente", path: "/client/dashboard", orderIndex: 9, role: UserRole.CLIENT },
    { name: "Configuracoes", path: "/settings", orderIndex: 10, role: UserRole.ADMIN }
  ];

  for (const feature of features) {
    await prisma.feature.upsert({
      where: { path: feature.path },
      update: feature,
      create: feature
    });
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
