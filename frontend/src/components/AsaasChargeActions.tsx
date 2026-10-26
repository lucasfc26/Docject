import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, FileText, ReceiptText, RefreshCw, X } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { apiDelete, apiPost, type ApiTransaction } from "../services/api";
import { Button } from "./ui";

const asaasStatusLabel: Record<string, string> = {
  PENDING: "Aguardando pagamento",
  RECEIVED: "Recebido",
  CONFIRMED: "Confirmado",
  RECEIVED_IN_CASH: "Recebido em dinheiro",
  OVERDUE: "Vencido",
  REFUNDED: "Estornado",
};

const linkClass =
  "inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[color:var(--line)] bg-[color:var(--panel)] px-3 text-xs font-semibold hover:bg-[color:var(--panel-strong)]";

/** Invoice controls (boleto + Pix through the admin's Asaas account) for one revenue entry. */
export function AsaasChargeActions({ order }: { order: ApiTransaction }) {
  const queryClient = useQueryClient();
  const refresh = (saved: ApiTransaction) => {
    queryClient.setQueryData<ApiTransaction[]>(["financial"], (current) =>
      current?.map((item) => (item.id === saved.id ? { ...item, ...saved } : item)),
    );
  };

  const issueMutation = useMutation({
    // BOLETO payments carry a Pix QR code too, so the invoice offers both.
    mutationFn: () => apiPost<ApiTransaction>(`/billing/transactions/${order.id}/charge`, { billingType: "BOLETO" }),
    onSuccess: refresh,
    meta: { successMessage: "Fatura emitida com Pix e boleto." },
  });
  const syncMutation = useMutation({
    mutationFn: () => apiPost<ApiTransaction>(`/billing/transactions/${order.id}/sync`, {}),
    onSuccess: refresh,
  });
  const cancelMutation = useMutation({
    mutationFn: () => apiDelete<ApiTransaction>(`/billing/transactions/${order.id}/charge`),
    onSuccess: refresh,
    meta: { successMessage: "Fatura cancelada no Asaas." },
  });

  if (order.kind !== "REVENUE" || order.status === "CANCELLED") return null;
  const busy = issueMutation.isPending || syncMutation.isPending || cancelMutation.isPending;

  if (!order.asaasPaymentId) {
    if (order.status === "PAID") return null;
    return (
      <div className="flex flex-wrap items-center gap-2 border-t border-current/10 pt-3 lg:col-span-3">
        <Button disabled={busy} type="button" variant="secondary" onClick={() => issueMutation.mutate()}>
          <ReceiptText size={16} />
          {issueMutation.isPending ? "Emitindo..." : "Gerar fatura (Pix + boleto)"}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-current/10 pt-3 lg:col-span-3">
      <span className="mono-label opacity-70">
        Fatura · {asaasStatusLabel[order.asaasStatus ?? ""] ?? order.asaasStatus ?? "Emitida"}
      </span>
      <Link className={linkClass} to={`/invoices/${order.id}`}>
        <FileText size={14} /> Ver fatura
      </Link>
      {order.asaasPixPayload ? (
        <button
          className={linkClass}
          type="button"
          onClick={() =>
            navigator.clipboard.writeText(order.asaasPixPayload ?? "").then(() => toast.success("Pix copia e cola copiado."))
          }
        >
          <Copy size={14} /> Pix copia e cola
        </button>
      ) : null}
      <button className={linkClass} disabled={busy} type="button" onClick={() => syncMutation.mutate()}>
        <RefreshCw size={14} /> Atualizar
      </button>
      {order.status !== "PAID" ? (
        <button
          className={linkClass}
          disabled={busy}
          type="button"
          onClick={() => {
            if (window.confirm("Cancelar esta fatura no Asaas?")) cancelMutation.mutate();
          }}
        >
          <X size={14} /> Cancelar fatura
        </button>
      ) : null}
    </div>
  );
}
