export type PlanId = "MONTHLY" | "YEARLY";

export type PlanDefinition = {
  id: PlanId;
  name: string;
  /** Amount charged on each Asaas payment. */
  price: number;
  /** Equivalent monthly amount shown to the customer. */
  monthlyEquivalent: number;
  periodMonths: number;
  description: string;
};

/** Paid plans of the admin accounts. Client accounts are free and need no subscription. */
export const PLANS: Record<PlanId, PlanDefinition> = {
  MONTHLY: {
    id: "MONTHLY",
    name: "Mensal",
    price: 34.9,
    monthlyEquivalent: 34.9,
    periodMonths: 1,
    description: "Cobranca recorrente todo mes. Cancele quando quiser.",
  },
  YEARLY: {
    id: "YEARLY",
    name: "Anual",
    price: 334.8,
    monthlyEquivalent: 27.9,
    periodMonths: 12,
    description: "Pagamento unico de R$ 334,80, equivalente a R$ 27,90 por mes.",
  },
};

/** Days after the end of the paid period before staff access is blocked. */
export const ACCESS_GRACE_DAYS = 3;

/** Platform owners (PLATFORM_OWNER_EMAILS, comma separated) never need a subscription. */
export function isPlatformOwner(email?: string | null) {
  if (!email) return false;
  const owners = (process.env.PLATFORM_OWNER_EMAILS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return owners.includes(email.trim().toLowerCase());
}
