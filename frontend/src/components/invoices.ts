import type { ApiInvoiceKind, ApiInvoiceSummary } from "../services/api";

export const invoiceKindLabel: Record<ApiInvoiceKind, string> = {
  PROJECT_INSTALLMENT: "Parcela de projeto",
  SERVICE: "Servico",
  OTHER: "Avulso",
};

export const invoiceStatus: Record<
  ApiInvoiceSummary["status"],
  { label: string; tone: "success" | "warning" | "danger" | "neutral" }
> = {
  PENDING: { label: "Em aberto", tone: "warning" },
  OVERDUE: { label: "Vencida", tone: "danger" },
  PAID: { label: "Paga", tone: "success" },
  CANCELLED: { label: "Cancelada", tone: "neutral" },
};

export function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString("pt-BR") : "-";
}

export function formatDocument(value: string | null) {
  if (!value) return "-";
  if (value.length === 11) return value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (value.length === 14) return value.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return value;
}
