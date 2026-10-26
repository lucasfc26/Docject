import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Eye, PlugZap, Save, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import {
  apiDelete,
  apiGet,
  apiPost,
  apiPut,
  type ApiAsaasCredential,
  type ApiBillingType,
} from "../../services/api";
import { Button, StatusBadge } from "../ui";
import { formatBrl } from "./PlanPicker";

const fieldClass =
  "mt-2 w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-4 py-3 outline-none";

export const billingTypeOptions: Array<{ label: string; value: ApiBillingType }> = [
  { label: "Fatura com boleto + Pix (recomendado)", value: "BOLETO" },
  { label: "Somente Pix", value: "PIX" },
  { label: "Cliente escolhe (Pix, boleto ou cartao)", value: "UNDEFINED" },
];

type BankForm = {
  environment: "PRODUCTION" | "SANDBOX";
  apiKey: string;
  webhookToken: string;
  autoCharge: boolean;
  defaultBillingType: ApiBillingType;
  chargeDaysBefore: string;
};

const emptyForm: BankForm = {
  environment: "PRODUCTION",
  apiKey: "",
  webhookToken: "",
  autoCharge: false,
  defaultBillingType: "BOLETO",
  chargeDaysBefore: "5",
};

/** Rendered only for admins: managers and financial staff cannot change the Asaas account. */
export function BankSettings() {
  const queryClient = useQueryClient();
  const { data: credential, isLoading } = useQuery({
    queryKey: ["billing-credentials"],
    queryFn: () => apiGet<ApiAsaasCredential>("/billing/credentials"),
  });
  const [form, setForm] = useState<BankForm>(emptyForm);
  const [revealedToken, setRevealedToken] = useState<string | null>(null);

  useEffect(() => {
    if (!credential) return;
    setForm(
      credential.configured
        ? {
            environment: credential.environment,
            apiKey: "",
            webhookToken: "",
            autoCharge: credential.autoCharge,
            defaultBillingType: credential.defaultBillingType,
            chargeDaysBefore: String(credential.chargeDaysBefore),
          }
        : emptyForm,
    );
    setRevealedToken(null);
  }, [credential]);

  const saveMutation = useMutation({
    mutationFn: () =>
      apiPut<ApiAsaasCredential>("/billing/credentials", {
        environment: form.environment,
        apiKey: form.apiKey.trim() || undefined,
        webhookToken: form.webhookToken.trim() || undefined,
        autoCharge: form.autoCharge,
        defaultBillingType: form.defaultBillingType,
        chargeDaysBefore: Number(form.chargeDaysBefore || 0),
      }),
    onSuccess: (saved) => queryClient.setQueryData(["billing-credentials"], saved),
    meta: { successMessage: "Conta Asaas validada e salva com criptografia." },
  });

  const testMutation = useMutation({
    mutationFn: () => apiPost<{ ok: boolean; balance: number }>("/billing/credentials/test", {}),
    onSuccess: (result) => toast.success(`Conexao ok. Saldo disponivel: ${formatBrl(result.balance)}`),
  });

  const removeMutation = useMutation({
    mutationFn: () => apiDelete<ApiAsaasCredential>("/billing/credentials"),
    onSuccess: (saved) => queryClient.setQueryData(["billing-credentials"], saved),
    meta: { successMessage: "Credenciais removidas." },
  });

  const revealMutation = useMutation({
    mutationFn: () => apiGet<{ webhookToken: string | null }>("/billing/credentials/webhook-token"),
    onSuccess: (result) => setRevealedToken(result.webhookToken),
  });

  if (isLoading || !credential) {
    return <p className="text-sm text-[color:var(--muted)]">Carregando dados bancarios...</p>;
  }

  const copy = (value: string, label: string) =>
    navigator.clipboard.writeText(value).then(() => toast.success(`${label} copiado.`));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start gap-3 rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-4">
        <ShieldCheck className="mt-0.5 shrink-0 text-[color:var(--primary)] dark:text-[color:var(--accent)]" size={20} />
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-semibold">Cobre seus clientes pela sua propria conta Asaas</p>
          <p className="mt-1 text-[color:var(--muted)]">
            Suas chaves ficam guardadas cifradas (AES-256-GCM) e nunca sao exibidas novamente. Com elas o sistema emite
            Pix e boletos dos projetos e servicos na data prevista, e o valor cai direto na sua conta.
          </p>
        </div>
        <StatusBadge tone={credential.configured ? "success" : "neutral"}>
          {credential.configured ? `Conectado ${credential.apiKeyMasked}` : "Nao configurado"}
        </StatusBadge>
      </div>

      <form
        className="grid gap-4 md:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          saveMutation.mutate();
        }}
      >
        <label className="block">
          <span className="mono-label text-[color:var(--muted)]">Ambiente</span>
          <select
            className={fieldClass}
            value={form.environment}
            onChange={(event) => setForm((current) => ({ ...current, environment: event.target.value as BankForm["environment"] }))}
          >
            <option value="PRODUCTION">Producao</option>
            <option value="SANDBOX">Sandbox (testes)</option>
          </select>
        </label>
        <label className="block">
          <span className="mono-label text-[color:var(--muted)]">Chave de API (access_token)</span>
          <input
            autoComplete="off"
            className={fieldClass}
            placeholder={credential.configured ? `${credential.apiKeyMasked} (deixe em branco para manter)` : "$aact_..."}
            required={!credential.configured}
            type="password"
            value={form.apiKey}
            onChange={(event) => setForm((current) => ({ ...current, apiKey: event.target.value }))}
          />
        </label>
        <label className="block">
          <span className="mono-label text-[color:var(--muted)]">Token do webhook (opcional)</span>
          <input
            autoComplete="off"
            className={fieldClass}
            placeholder={credential.configured && credential.hasWebhookToken ? "Ja definido (deixe em branco para manter)" : "Gerado automaticamente se vazio"}
            type="password"
            value={form.webhookToken}
            onChange={(event) => setForm((current) => ({ ...current, webhookToken: event.target.value }))}
          />
        </label>
        <label className="block">
          <span className="mono-label text-[color:var(--muted)]">Forma de cobranca padrao</span>
          <select
            className={fieldClass}
            value={form.defaultBillingType}
            onChange={(event) => setForm((current) => ({ ...current, defaultBillingType: event.target.value as ApiBillingType }))}
          >
            {billingTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-3 rounded-2xl border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-4 py-3">
          <input
            checked={form.autoCharge}
            className="h-4 w-4"
            type="checkbox"
            onChange={(event) => setForm((current) => ({ ...current, autoCharge: event.target.checked }))}
          />
          <span className="text-sm">
            <span className="font-semibold">Cobranca automatica</span>
            <span className="block text-[color:var(--muted)]">Emite a cobranca das receitas pendentes antes do vencimento.</span>
          </span>
        </label>
        <label className="block">
          <span className="mono-label text-[color:var(--muted)]">Emitir quantos dias antes do vencimento</span>
          <input
            className={fieldClass}
            disabled={!form.autoCharge}
            max={30}
            min={0}
            type="number"
            value={form.chargeDaysBefore}
            onChange={(event) => setForm((current) => ({ ...current, chargeDaysBefore: event.target.value }))}
          />
        </label>
        <div className="flex flex-wrap gap-2 md:col-span-2">
          <Button disabled={saveMutation.isPending} type="submit">
            <Save size={17} />
            {saveMutation.isPending ? "Validando com o Asaas..." : "Salvar"}
          </Button>
          {credential.configured ? (
            <>
              <Button disabled={testMutation.isPending} type="button" variant="secondary" onClick={() => testMutation.mutate()}>
                <PlugZap size={17} /> Testar conexao
              </Button>
              <Button
                disabled={removeMutation.isPending}
                type="button"
                variant="ghost"
                onClick={() => {
                  if (window.confirm("Remover as credenciais do Asaas? Cobrancas automaticas deixarao de ser emitidas.")) {
                    removeMutation.mutate();
                  }
                }}
              >
                <Trash2 size={17} /> Remover
              </Button>
            </>
          ) : null}
        </div>
      </form>

      {credential.configured ? (
        <div className="space-y-3 rounded-2xl border border-[color:var(--line)] p-4 text-sm">
          <p className="font-semibold">Webhook para baixa automatica</p>
          <p className="text-[color:var(--muted)]">
            No painel do Asaas, va em Integracoes &gt; Webhooks, crie um webhook de Cobrancas com a URL e o token abaixo. Assim os
            pagamentos recebidos sao marcados como pagos aqui automaticamente.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded-xl bg-[color:var(--panel-strong)] px-3 py-2">{credential.webhookUrl}</code>
            <Button type="button" variant="secondary" onClick={() => copy(credential.webhookUrl, "URL")}>
              <Copy size={16} /> Copiar
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded-xl bg-[color:var(--panel-strong)] px-3 py-2">
              {revealedToken ?? "••••••••••••••••"}
            </code>
            {revealedToken ? (
              <Button type="button" variant="secondary" onClick={() => copy(revealedToken, "Token")}>
                <Copy size={16} /> Copiar
              </Button>
            ) : (
              <Button disabled={revealMutation.isPending} type="button" variant="secondary" onClick={() => revealMutation.mutate()}>
                <Eye size={16} /> Mostrar token
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
