import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Copy, ExternalLink, Printer } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { BoletoBarcode } from "../components/BoletoBarcode";
import { formatDate, formatDocument, formatMoney, invoiceStatus } from "../components/invoices";
import { Button } from "../components/ui";
import { apiGet, type ApiInvoice } from "../services/api";

const NAVY = "#172540";
const TEAL = "#2a8c82";

/**
 * Printable invoice following the company model: header band, payer block, services
 * summary with totals and, on the second page, Pix and boleto side by side.
 */
export function InvoicePage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { data: invoice, isLoading, error } = useQuery({
    queryKey: ["invoice", id],
    queryFn: () => apiGet<ApiInvoice>(`/invoices/${id}`),
    enabled: Boolean(id),
  });

  const copy = (value: string, label: string) =>
    navigator.clipboard.writeText(value).then(() => toast.success(`${label} copiado.`));

  return (
    <div className="min-h-screen px-4 py-8 print:bg-white print:p-0">
      <div className="mx-auto mb-4 flex max-w-[860px] flex-wrap items-center justify-between gap-2 print:hidden">
        <Button type="button" variant="secondary" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))}>
          <ArrowLeft size={16} /> Voltar
        </Button>
        {invoice ? (
          <div className="flex flex-wrap gap-2">
            {invoice.invoiceUrl && invoice.status !== "PAID" ? (
              <a
                className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[color:var(--line)] bg-[color:var(--panel)] px-4 text-sm font-semibold hover:bg-[color:var(--panel-strong)]"
                href={invoice.invoiceUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                <ExternalLink size={16} /> Pagar com cartao
              </a>
            ) : null}
            <Button type="button" onClick={() => window.print()}>
              <Printer size={16} /> Imprimir / salvar PDF
            </Button>
          </div>
        ) : null}
      </div>

      {isLoading ? <p className="text-center text-sm text-[color:var(--muted)]">Carregando fatura...</p> : null}
      {error ? <p className="text-center text-sm text-ember-600">Nao foi possivel carregar esta fatura.</p> : null}

      {invoice ? <InvoiceDocument invoice={invoice} onCopy={copy} /> : null}
    </div>
  );
}

function InvoiceDocument({ invoice, onCopy }: { invoice: ApiInvoice; onCopy: (value: string, label: string) => void }) {
  const issuerName = invoice.issuer?.name ?? "Docject";
  const status = invoiceStatus[invoice.status];

  return (
    <article className="mx-auto max-w-[860px] bg-white text-[13px] text-zinc-800 shadow-panel print:max-w-none print:shadow-none">
      {/* Page 1 */}
      <div className="p-6 md:p-10 print:p-8">
        <header className="flex flex-wrap items-start justify-between gap-6 px-6 py-7 text-white md:px-8" style={{ background: NAVY }}>
          <div>
            <h1 className="text-2xl font-bold uppercase tracking-tight md:text-3xl">{issuerName}</h1>
            <p className="mt-3 text-xs text-white/80">
              {[invoice.issuer?.document ? `CPF/CNPJ: ${formatDocument(invoice.issuer.document)}` : null, invoice.issuer?.email]
                .filter(Boolean)
                .join(" • ")}
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold tracking-wide md:text-4xl">FATURA</p>
            <p className="mt-1 text-xs text-white/80">
              Nº {invoice.number} | EMISSÃO {formatDate(invoice.issuedAt)}
            </p>
            <p className="mt-1 text-xs text-white/80">VENCIMENTO {formatDate(invoice.dueDate)}</p>
            <span
              className="mt-2 inline-block rounded-full px-3 py-0.5 text-[11px] font-semibold"
              style={{
                background: status.tone === "success" ? "#d7f2e8" : status.tone === "danger" ? "#fde2e2" : "#fff1d6",
                color: status.tone === "success" ? "#0c8259" : status.tone === "danger" ? "#b42318" : "#9a5b00",
              }}
            >
              {status.label}
            </span>
          </div>
        </header>

        <section className="mt-8">
          <SectionLabel>Cobrança para</SectionLabel>
          <div className="mt-2 grid border border-slate-200 bg-slate-50 md:grid-cols-[1.3fr_1fr_1fr]">
            <Cell label="Cliente / razão social" strong value={invoice.customer?.name ?? "-"} />
            <Cell label="CPF / CNPJ" strong value={formatDocument(invoice.customer?.document ?? null)} />
            <Cell label="Contato" strong value={invoice.customer?.contact ?? "-"} />
            <Cell label="Endereço" value={invoice.customer?.address ?? "Endereço não informado"} />
            <Cell label="Referência" value={invoice.line.reference} />
            <Cell label="Período" value={invoice.line.period} />
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-sm font-bold uppercase" style={{ color: NAVY }}>
            Resumo dos serviços
          </h2>
          <table className="mt-3 w-full border border-slate-200">
            <thead>
              <tr className="text-left text-[11px] font-bold uppercase text-white" style={{ background: NAVY }}>
                <th className="px-4 py-3">Descrição</th>
                <th className="w-36 px-4 py-3">Período</th>
                <th className="w-36 px-4 py-3">Valor</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-slate-200">
                <td className="px-4 py-5">
                  <p className="font-bold" style={{ color: NAVY }}>
                    {invoice.line.title}
                  </p>
                  {invoice.line.subtitle ? <p className="mt-0.5 text-zinc-600">{invoice.line.subtitle}</p> : null}
                </td>
                <td className="border-l border-slate-200 px-4 py-5">{invoice.line.period}</td>
                <td className="border-l border-slate-200 px-4 py-5 font-bold">{formatMoney(invoice.amount)}</td>
              </tr>
            </tbody>
          </table>

          <div className="ml-auto mt-5 w-full max-w-sm">
            <TotalRow label="Subtotal" value={formatMoney(invoice.amount)} />
            <TotalRow label="Desconto / ajustes" value={formatMoney(0)} />
            <div
              className="mt-1 flex items-center justify-between border px-4 py-3"
              style={{ background: "#e8f3f1", borderColor: "#b9ddd8" }}
            >
              <span className="text-[11px] font-bold uppercase text-zinc-500">Total a pagar</span>
              <span className="text-2xl font-bold" style={{ color: NAVY }}>
                {formatMoney(invoice.amount)}
              </span>
            </div>
          </div>
        </section>
      </div>

      {/* Page 2 */}
      <div className="p-6 pt-0 md:p-10 md:pt-0 print:break-before-page print:p-8">
        <h2 className="text-sm font-bold uppercase" style={{ color: NAVY }}>
          Pague como preferir
        </h2>

        {invoice.status === "PAID" ? (
          <p className="mt-4 border border-slate-200 bg-slate-50 p-6 text-center font-semibold" style={{ color: TEAL }}>
            Pagamento confirmado. Obrigado pela parceria!
          </p>
        ) : !invoice.issued ? (
          <p className="mt-4 border border-slate-200 bg-slate-50 p-6 text-center text-zinc-500">
            As formas de pagamento ainda não foram emitidas.
          </p>
        ) : (
          <div className="mt-4 grid border border-slate-200 bg-slate-50 md:grid-cols-2">
            <div className="p-5">
              <SectionLabel>01 • Pix</SectionLabel>
              {invoice.pix ? (
                <>
                  <p className="mt-1">Escaneie o QR Code ou use o código copia e cola.</p>
                  <p className="mt-3 text-[11px] font-bold uppercase text-zinc-500">Favorecido</p>
                  <p>{issuerName}</p>
                  {invoice.pix.qrImage ? (
                    <img
                      alt="QR Code Pix"
                      className="mt-4 h-44 w-44 border-2 bg-white p-1"
                      src={`data:image/png;base64,${invoice.pix.qrImage}`}
                      style={{ borderColor: TEAL }}
                    />
                  ) : null}
                  <p className="mt-4 text-[11px] font-bold uppercase text-zinc-500">Pix copia e cola</p>
                  <p className="mt-1 break-all font-mono text-[11px]">{invoice.pix.payload}</p>
                  <Button className="mt-3 print:hidden" type="button" onClick={() => onCopy(invoice.pix!.payload, "Código Pix")}>
                    <Copy size={16} /> Copiar código Pix
                  </Button>
                </>
              ) : (
                <p className="mt-1 text-zinc-500">Pix indisponível para esta fatura.</p>
              )}
            </div>

            <div className="border-t border-slate-200 p-5 md:border-l md:border-t-0">
              <SectionLabel>02 • Boleto bancário</SectionLabel>
              {invoice.boleto ? (
                <>
                  <p className="mt-1">Beneficiário: {issuerName}</p>
                  <p>Banco / instituição: Asaas</p>
                  {invoice.boleto.nossoNumero ? <p>Nosso número: {invoice.boleto.nossoNumero}</p> : null}
                  {invoice.boleto.identificationField ? (
                    <>
                      <p className="mt-3 text-[11px] font-bold uppercase text-zinc-500">Linha digitável</p>
                      <p className="break-all font-bold" style={{ color: NAVY }}>
                        {invoice.boleto.identificationField}
                      </p>
                    </>
                  ) : null}
                  <p className="mt-3">
                    Vencimento: {formatDate(invoice.dueDate)} • Valor: {formatMoney(invoice.amount)}
                  </p>
                  {invoice.boleto.barCode ? (
                    <>
                      <p className="mt-4 text-[11px] font-bold uppercase text-zinc-500">Código de barras</p>
                      <div className="mt-1 border border-slate-200 bg-white px-3 py-2">
                        <BoletoBarcode value={invoice.boleto.barCode} />
                      </div>
                    </>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2 print:hidden">
                    {invoice.boleto.identificationField ? (
                      <Button type="button" onClick={() => onCopy(invoice.boleto!.identificationField!, "Linha digitável")}>
                        <Copy size={16} /> Copiar linha digitável
                      </Button>
                    ) : null}
                    {invoice.boleto.url ? (
                      <a
                        className="inline-flex min-h-10 items-center gap-2 rounded-full border border-slate-300 bg-white px-4 text-sm font-semibold hover:bg-slate-100"
                        href={invoice.boleto.url}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        <ExternalLink size={16} /> Boleto em PDF
                      </a>
                    ) : null}
                  </div>
                </>
              ) : (
                <p className="mt-1 text-zinc-500">Boleto indisponível para esta fatura.</p>
              )}
            </div>
          </div>
        )}

        <section className="mt-8">
          <h2 className="border-b-2 pb-2 text-sm font-bold uppercase" style={{ color: NAVY, borderColor: TEAL }}>
            Informações importantes
          </h2>
          <div className="mt-3 grid gap-4 text-xs text-zinc-600 md:grid-cols-[1.4fr_1fr]">
            <ul className="space-y-1">
              <li>• Pagamento até a data de vencimento indicada.</li>
              <li>• A baixa é automática após a confirmação do pagamento; não é preciso enviar comprovante.</li>
              <li>• Escopo e condições conforme proposta/contrato: {invoice.line.reference}.</li>
            </ul>
            <div>
              <p className="uppercase">Contato</p>
              {invoice.issuer?.email ? <p className="font-bold">{invoice.issuer.email}</p> : null}
              {invoice.issuer?.phone ? <p className="font-bold">{invoice.issuer.phone}</p> : null}
              <p>Obrigado pela parceria.</p>
            </div>
          </div>
        </section>
      </div>
    </article>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold uppercase" style={{ color: TEAL }}>
      {children}
    </p>
  );
}

function Cell({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="border-b border-slate-200 md:border-r md:[&:nth-child(3n)]:border-r-0">
      <p className="border-b border-slate-200 px-3 py-1.5 text-[10px] font-bold uppercase text-zinc-500">{label}</p>
      <p className={`px-3 py-2.5 ${strong ? "text-sm font-bold" : ""}`} style={strong ? { color: NAVY } : undefined}>
        {value}
      </p>
    </div>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-1.5">
      <span className="text-xs text-zinc-500">{label}</span>
      <span>{value}</span>
    </div>
  );
}
