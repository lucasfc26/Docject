import { Check } from "lucide-react";
import type { ApiPlan, ApiPlanId } from "../../services/api";
import { cn } from "../ui";

export function formatBrl(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function PlanPicker({
  plans,
  value,
  onChange,
  currentPlan,
  disabled,
}: {
  plans: ApiPlan[];
  value: ApiPlanId;
  onChange: (plan: ApiPlanId) => void;
  currentPlan?: ApiPlanId;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {plans.map((plan) => {
        const selected = plan.id === value;
        return (
          <button
            className={cn(
              "relative flex flex-col rounded-2xl border p-4 text-left transition disabled:opacity-60",
              selected
                ? "border-[color:var(--primary)] bg-[color:var(--accent)]/10 ring-2 ring-[color:var(--accent)] dark:border-[color:var(--warning)]"
                : "border-[color:var(--line)] bg-[color:var(--panel-strong)] hover:border-[color:var(--accent)]",
            )}
            disabled={disabled}
            key={plan.id}
            type="button"
            onClick={() => onChange(plan.id)}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="mono-label text-[color:var(--muted)]">{plan.name}</span>
              {plan.id === "YEARLY" ? (
                <span className="rounded-full bg-mint-500/15 px-2 py-0.5 text-[11px] font-semibold text-mint-600 dark:text-mint-400">
                  Economize 20%
                </span>
              ) : null}
            </span>
            <span className="mt-2 font-display text-2xl font-bold">
              {formatBrl(plan.monthlyEquivalent)}
              <span className="text-sm font-medium text-[color:var(--muted)]">/mes</span>
            </span>
            <span className="mt-1 text-xs text-[color:var(--muted)]">
              {plan.id === "YEARLY" ? `${formatBrl(plan.price)} pagos de uma vez` : "Cobrado todo mes"}
            </span>
            <span className="mt-3 text-sm">{plan.description}</span>
            {currentPlan === plan.id ? (
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[color:var(--primary)] dark:text-[color:var(--accent)]">
                <Check size={14} /> Plano atual
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
