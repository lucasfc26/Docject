import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { apiGet, apiPost, type ApiPlanId, type ApiSubscription } from "../../services/api";
import { Button, StatusBadge } from "../ui";
import { PlanPicker } from "./PlanPicker";

const statusLabel: Record<ApiSubscription["status"], { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  ACTIVE: { label: "Ativa", tone: "success" },
  PENDING: { label: "Aguardando pagamento", tone: "warning" },
  OVERDUE: { label: "Pagamento atrasado", tone: "danger" },
  CANCELLED: { label: "Cancelada", tone: "neutral" },
};

/** Paid plan of the admin account; managers and financial staff see the admin's status. */
export function SubscriptionSettings({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const { data: subscription, isLoading } = useQuery({
    queryKey: ["subscription"],
    queryFn: () => apiGet<ApiSubscription>("/subscription"),
  });
  const [plan, setPlan] = useState<ApiPlanId>("MONTHLY");
  const [cpfCnpj, setCpfCnpj] = useState("");

  useEffect(() => {
    if (subscription) setPlan(subscription.plan);
  }, [subscription]);

  const checkoutMutation = useMutation({
    mutationFn: () => apiPost<ApiSubscription>("/subscription/checkout", { plan, cpfCnpj: cpfCnpj || undefined }),
    onSuccess: (saved) => {
      queryClient.setQueryData(["subscription"], saved);
      setCpfCnpj("");
      if (saved.checkoutUrl) window.open(saved.checkoutUrl, "_blank", "noopener,noreferrer");
    },
    meta: { successMessage: "Cobranca gerada. Conclua o pagamento na pagina do Asaas." },
  });

  const cancelMutation = useMutation({
    mutationFn: () => apiPost<ApiSubscription>("/subscription/cancel", {}),
    onSuccess: (saved) => queryClient.setQueryData(["subscription"], saved),
    meta: { successMessage: "Renovacao cancelada." },
  });

  if (isLoading || !subscription) {
    return <p className="text-sm text-[color:var(--muted)]">Carregando assinatura...</p>;
  }

  if (subscription.ownerExempt) {
    return (
      <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-4 text-sm">
        <p className="font-semibold">Conta do dono da plataforma</p>
        <p className="mt-1 text-[color:var(--muted)]">Esta conta nao precisa de assinatura.</p>
      </div>
    );
  }

  const status = statusLabel[subscription.status];
  const needsDocument = !subscription.hasDocument;
  const currentPlanName = subscription.plans.find((item) => item.id === subscription.plan)?.name ?? subscription.plan;
  const renewing = subscription.status === "ACTIVE" && subscription.plan === "MONTHLY";

  return (
    <div className="space-y-6">
      {!subscription.active ? (
        <div className="rounded-2xl border border-ember-500/40 bg-ember-500/10 p-4 text-sm">
          <p className="font-semibold">Acesso bloqueado ate a confirmacao do pagamento</p>
          <p className="mt-1">
            {canManage
              ? "Escolha um plano e conclua o pagamento para liberar o sistema para voce e sua equipe."
              : "Peca ao administrador da conta para regularizar a assinatura."}
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-4">
        <div>
          <p className="mono-label text-[color:var(--muted)]">Plano</p>
          <p className="mt-1 font-display text-xl font-semibold">{currentPlanName}</p>
          {subscription.currentPeriodEnd ? (
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              {subscription.status === "CANCELLED" ? "Acesso ate" : "Pago ate"}{" "}
              {new Date(subscription.currentPeriodEnd).toLocaleDateString("pt-BR")}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
          {canManage && subscription.checkoutUrl ? (
            <a
              className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[color:var(--primary)] px-4 text-sm font-semibold text-white hover:opacity-90 dark:bg-[color:var(--warning)] dark:text-zinc-950"
              href={subscription.checkoutUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              <ExternalLink size={16} /> Pagar agora
            </a>
          ) : null}
        </div>
      </div>

      {canManage ? (
        <>
          <PlanPicker currentPlan={subscription.plan} plans={subscription.plans} value={plan} onChange={setPlan} />
          <form
            className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              checkoutMutation.mutate();
            }}
          >
            <label className="block">
              <span className="mono-label text-[color:var(--muted)]">
                CPF ou CNPJ do titular {needsDocument ? "" : "(opcional, ja cadastrado)"}
              </span>
              <input
                className="mt-2 w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-4 py-3 outline-none"
                inputMode="numeric"
                maxLength={18}
                required={needsDocument}
                value={cpfCnpj}
                onChange={(event) => setCpfCnpj(event.target.value.replace(/[^\d./-]/g, ""))}
              />
            </label>
            <Button
              disabled={
                checkoutMutation.isPending ||
                !subscription.paymentsEnabled ||
                (subscription.status === "ACTIVE" && plan === subscription.plan)
              }
              type="submit"
            >
              <CreditCard size={17} />
              {checkoutMutation.isPending
                ? "Gerando cobranca..."
                : plan === subscription.plan
                  ? "Gerar cobranca"
                  : `Assinar plano ${subscription.plans.find((item) => item.id === plan)?.name ?? ""}`}
            </Button>
            {!subscription.paymentsEnabled ? (
              <p className="text-sm text-ember-600 dark:text-ember-400 md:col-span-2">
                Pagamentos de assinatura ainda nao estao habilitados neste servidor.
              </p>
            ) : null}
            <p className="text-xs text-[color:var(--muted)] md:col-span-2">
              O pagamento e processado pelo Asaas (Pix, boleto ou cartao). O acesso e liberado assim que o pagamento for
              confirmado e vale para voce e toda a sua equipe. Clientes acessam gratuitamente.
            </p>
          </form>
          {renewing ? (
            <Button
              disabled={cancelMutation.isPending}
              type="button"
              variant="ghost"
              onClick={() => {
                if (window.confirm("Cancelar a renovacao mensal? O acesso continua ate o fim do periodo pago.")) {
                  cancelMutation.mutate();
                }
              }}
            >
              Cancelar renovacao
            </Button>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-[color:var(--muted)]">Somente o administrador da conta pode alterar o plano.</p>
      )}
    </div>
  );
}
