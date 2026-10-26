import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Barcode, Copy, ExternalLink, QrCode, RefreshCw, X } from "lucide-react";
import { toast } from "react-toastify";
import { apiDelete, apiPost, type ApiBillingType, type ApiTransaction } from "../services/api";
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

/** Asaas charge controls for one revenue entry of the financial schedule. */
export function AsaasChargeActions({ order }: { order: ApiTransaction }) {
  const queryClient = useQueryClient();
  const refresh = (saved: ApiTransaction) => {
    queryClient.setQueryData<ApiTransaction[]>(["financial"], (current) =>
      current?.map((item) => (item.id === saved.id ? { ...item, ...saved } : item)),
    );
  };

  const chargeMutation = useMutation({
    mutationFn: (billingType: ApiBillingType) =>
      apiPost<ApiTransaction>(`/billing/transactions/${order.id}/charge`, { billingType }),
    onSuccess: refresh,
    meta: { successMessage: "Cobranca emitida no Asaas." },
  });
  const syncMutation = useMutation({
    mutationFn: () => apiPost<ApiTransaction>(`/billing/transactions/${order.id}/sync`, {}),
    onSuccess: refresh,
  });
  const cancelMutation = useMutation({
    mutationFn: () => apiDelete<ApiTransaction>(`/billing/transactions/${order.id}/charge`),
    onSuccess: refresh,
    meta: { successMessage: "Cobranca cancelada no Asaas." },
  });

  if (order.kind !== "REVENUE" || order.status === "CANCELLED") return null;
  const busy = chargeMutation.isPending || syncMutation.isPending || cancelMutation.isPending;

  if (!order.asaasPaymentId) {
    if (order.status === "PAID") return null;
    return (
      <div className="flex flex-wrap items-center gap-2 border-t border-current/10 pt-3 lg:col-span-3">
        <span className="mono-label opacity-70">Cobrar via Asaas</span>
        <Button disabled={busy} type="button" variant="secondary" onClick={() => chargeMutation.mutate("PIX")}>
          <QrCode size={16} /> Pix
        </Button>
        <Button disabled={busy} type="button" variant="secondary" onClick={() => chargeMutation.mutate("BOLETO")}>
          <Barcode size={16} /> Boleto
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-current/10 pt-3 lg:col-span-3">
      <span className="mono-label opacity-70">
        Asaas {order.asaasBillingType === "BOLETO" ? "boleto" : order.asaasBillingType === "PIX" ? "Pix" : ""} ·{" "}
        {asaasStatusLabel[order.asaasStatus ?? ""] ?? order.asaasStatus ?? "Emitida"}
      </span>
      {order.asaasInvoiceUrl ? (
        <a className={linkClass} href={order.asaasInvoiceUrl} rel="noopener noreferrer" target="_blank">
          <ExternalLink size={14} /> Fatura
        </a>
      ) : null}
      {order.asaasBankSlipUrl ? (
        <a className={linkClass} href={order.asaasBankSlipUrl} rel="noopener noreferrer" target="_blank">
          <Barcode size={14} /> Boleto PDF
        </a>
      ) : null}
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
            if (window.confirm("Cancelar esta cobranca no Asaas?")) cancelMutation.mutate();
          }}
        >
          <X size={14} /> Cancelar cobranca
        </button>
      ) : null}
    </div>
  );
}
