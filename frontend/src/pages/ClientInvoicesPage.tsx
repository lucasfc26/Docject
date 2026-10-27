import { useQuery } from "@tanstack/react-query";
import { FileCheck2, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDate, formatMoney, invoiceKindLabel, invoiceStatus } from "../components/invoices";
import { Panel, StatusBadge } from "../components/ui";
import { apiGet, type ApiInvoiceSummary } from "../services/api";

export function ClientInvoicesPage() {
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["client-invoices"],
    queryFn: () => apiGet<ApiInvoiceSummary[]>("/invoices"),
  });
  const open = invoices
    .filter((invoice) => invoice.status === "PENDING" || invoice.status === "OVERDUE")
    .sort((a, b) => new Date(a.dueDate ?? 0).getTime() - new Date(b.dueDate ?? 0).getTime());
  const paid = invoices.filter((invoice) => invoice.status === "PAID");
  const openTotal = open.reduce((sum, invoice) => sum + invoice.amount, 0);

  return (
    <div className="space-y-6">
      <Panel className="p-6">
        <p className="mono-label text-[color:var(--muted)]">Docject</p>
        <h1 className="mt-1 font-display text-3xl font-bold">Faturas</h1>
        <p className="mt-2 text-[color:var(--muted)]">Parcelas de projetos e mensalidades de servicos, com Pix e boleto.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Summary label="Em aberto" value={formatMoney(openTotal)} />
          <Summary label="Faturas em aberto" value={String(open.length)} />
          <Summary label="Faturas pagas" value={String(paid.length)} />
        </div>
      </Panel>

      {isLoading ? <p className="text-sm text-[color:var(--muted)]">Carregando faturas...</p> : null}

      {!isLoading ? (
        <>
          <InvoiceSection empty="Nenhuma fatura em aberto." invoices={open} title="Pendentes" />
          <InvoiceSection empty="Nenhuma fatura paga ainda." invoices={paid} title="Pagas" />
        </>
      ) : null}
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-4">
      <p className="mono-label text-[color:var(--muted)]">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold">{value}</p>
    </div>
  );
}

function InvoiceSection({ title, invoices, empty }: { title: string; invoices: ApiInvoiceSummary[]; empty: string }) {
  return (
    <Panel className="p-6">
      <h2 className="font-display text-2xl font-semibold">{title}</h2>
      <div className="mt-4 grid gap-3">
        {invoices.map((invoice) => {
          const status = invoiceStatus[invoice.status];
          return (
            <div
              className="grid gap-3 rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-4 md:grid-cols-[minmax(0,1fr)_auto_auto_auto] md:items-center"
              key={invoice.id}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone="neutral">{invoiceKindLabel[invoice.kind]}</StatusBadge>
                  <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                </div>
                <p className="mt-2 font-semibold">{invoice.description}</p>
                <p className="mt-1 text-sm text-[color:var(--muted)]">Vencimento {formatDate(invoice.dueDate)}</p>
              </div>
              <p className="font-display text-xl font-bold">{formatMoney(invoice.amount)}</p>
              {invoice.nfsePdfUrl ? (
                <a
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[color:var(--line)] bg-[color:var(--panel)] px-4 text-sm font-semibold hover:bg-[color:var(--panel-strong)]"
                  href={invoice.nfsePdfUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <FileCheck2 size={16} /> Nota fiscal
                </a>
              ) : (
                <span className="hidden md:block" />
              )}
              {invoice.issued ? (
                <Link
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-[color:var(--primary)] px-4 text-sm font-semibold text-white hover:opacity-90 dark:bg-[color:var(--warning)] dark:text-zinc-950"
                  to={`/invoices/${invoice.id}`}
                >
                  <FileText size={16} />
                  {invoice.status === "PAID" ? "Ver fatura" : "Pagar"}
                </Link>
              ) : (
                <span className="text-sm text-[color:var(--muted)]">
                  {invoice.status === "PAID" ? "Pago" : "Fatura ainda nao emitida"}
                </span>
              )}
            </div>
          );
        })}
        {!invoices.length ? (
          <p className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-4 text-sm text-[color:var(--muted)]">
            {empty}
          </p>
        ) : null}
      </div>
    </Panel>
  );
}
