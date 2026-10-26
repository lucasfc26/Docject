import { Prisma } from "@prisma/client";
import { AsaasCustomerInput, onlyDigits } from "../../common/asaas/asaas.client";

const clientInclude = {
  contacts: { select: { email: true, phone: true } },
  users: { select: { id: true, email: true, phone: true } },
} satisfies Prisma.ClientInclude;

export const transactionInclude = {
  module: {
    include: {
      project: {
        include: {
          client: { include: clientInclude },
          modules: { select: { id: true, orderIndex: true }, orderBy: { orderIndex: "asc" } },
        },
      },
    },
  },
  service: { include: { client: { include: clientInclude } } },
} satisfies Prisma.FinancialTransactionInclude;

export type InvoiceTransaction = Prisma.FinancialTransactionGetPayload<{ include: typeof transactionInclude }>;
export type InvoiceClient = NonNullable<ReturnType<typeof transactionClient>>;

export function transactionClient(transaction: InvoiceTransaction) {
  return transaction.module?.project.client ?? transaction.service?.client ?? null;
}

export function transactionOwnerId(transaction: InvoiceTransaction) {
  return transactionClient(transaction)?.ownerId ?? null;
}

export function invoiceKind(transaction: InvoiceTransaction): "PROJECT_INSTALLMENT" | "SERVICE" | "OTHER" {
  if (transaction.module) return "PROJECT_INSTALLMENT";
  if (transaction.service) return "SERVICE";
  return "OTHER";
}

/** What the charge is about, as printed on the invoice and sent to Asaas. */
export function invoiceDescription(transaction: InvoiceTransaction) {
  const module = transaction.module;
  if (module) {
    const modules = module.project.modules;
    const position = modules.findIndex((item) => item.id === module.id) + 1;
    return `Parcela ${position || 1} de ${modules.length || 1} do projeto ${module.project.name} - etapa ${module.name}`;
  }
  const service = transaction.service;
  if (service) {
    const [year, month] = (transaction.servicePeriod ?? "").split("-");
    const period = year && month ? ` - mensalidade de ${month}/${year}` : "";
    return `Servico ${service.name}${period}`;
  }
  return transaction.entity;
}

/** Line of the "Resumo dos servicos" table plus the reference and period of the invoice. */
export function invoiceLine(transaction: InvoiceTransaction) {
  const module = transaction.module;
  if (module) {
    const modules = module.project.modules;
    const position = modules.findIndex((item) => item.id === module.id) + 1;
    const period =
      module.startDate && module.endDate
        ? `${dayMonth(module.startDate)}–${dayMonth(module.endDate)}`
        : monthYear(module.completedAt ?? transaction.dueDate);
    return {
      title: `Desenvolvimento - parcela ${position || 1} de ${modules.length || 1}`,
      subtitle: `Projeto ${module.project.name} - etapa ${module.name}`,
      reference: `Projeto ${module.project.name}`,
      period,
    };
  }
  const service = transaction.service;
  if (service) {
    const [year, month] = (transaction.servicePeriod ?? "").split("-");
    const period = year && month ? `${month}/${year}` : monthYear(transaction.dueDate);
    return {
      title: `${service.name} - mensalidade`,
      subtitle: service.description || "Manutencao, suporte tecnico e monitoramento",
      reference: `Servico ${service.name}`,
      period,
    };
  }
  return { title: transaction.entity, subtitle: null, reference: "Cobranca avulsa", period: monthYear(transaction.dueDate) };
}

function dayMonth(date: Date) {
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthYear(date?: Date | null) {
  return date ? `${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}` : "-";
}

export function clientDocument(client: InvoiceClient) {
  return onlyDigits(client.document) || onlyDigits(client.cpf);
}

export function asaasCustomerData(client: InvoiceClient): AsaasCustomerInput {
  return {
    name: client.name,
    cpfCnpj: clientDocument(client),
    email: client.email ?? client.contacts[0]?.email ?? client.users[0]?.email ?? undefined,
    phone: onlyDigits(client.contacts[0]?.phone ?? client.users[0]?.phone) || undefined,
    postalCode: onlyDigits(client.postalCode) || undefined,
    address: client.address ?? undefined,
    addressNumber: client.addressNumber ?? undefined,
    complement: client.complement ?? undefined,
    province: client.province ?? undefined,
    externalReference: `client:${client.id}`,
  };
}

export function formatClientAddress(client: InvoiceClient) {
  const street = [client.address, client.addressNumber].filter(Boolean).join(", ");
  const line1 = [street, client.complement].filter(Boolean).join(" - ");
  const cityState = [client.city, client.state].filter(Boolean).join("/");
  const line2 = [client.province, cityState].filter(Boolean).join(" - ");
  const postalCode = onlyDigits(client.postalCode);
  const cep = postalCode.length === 8 ? `CEP ${postalCode.slice(0, 5)}-${postalCode.slice(5)}` : "";
  return [line1, line2, cep].filter(Boolean).join(" | ") || null;
}
