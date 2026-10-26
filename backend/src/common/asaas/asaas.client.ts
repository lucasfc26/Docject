import { BadGatewayException } from "@nestjs/common";

export type AsaasEnvironment = "PRODUCTION" | "SANDBOX";
export type AsaasBillingType = "PIX" | "BOLETO" | "UNDEFINED";

const BASE_URLS: Record<AsaasEnvironment, string> = {
  PRODUCTION: "https://api.asaas.com/v3",
  SANDBOX: "https://api-sandbox.asaas.com/v3",
};

export type AsaasCustomer = { id: string; name: string; cpfCnpj?: string; email?: string };

export type AsaasCustomerInput = {
  name: string;
  cpfCnpj: string;
  email?: string;
  phone?: string;
  postalCode?: string;
  address?: string;
  addressNumber?: string;
  complement?: string;
  province?: string;
  externalReference?: string;
};

export type AsaasIdentificationField = { identificationField: string; nossoNumero?: string; barCode?: string };

export type AsaasPayment = {
  id: string;
  status: string;
  billingType: string;
  value: number;
  dueDate: string;
  invoiceUrl?: string;
  invoiceNumber?: string | null;
  bankSlipUrl?: string | null;
  externalReference?: string | null;
  subscription?: string | null;
};

export type AsaasSubscription = { id: string; status: string; nextDueDate: string };

export type AsaasPixQrCode = { encodedImage: string; payload: string; expirationDate?: string };

/** Minimal Asaas v3 REST client; one instance per API key. */
export class AsaasClient {
  constructor(
    private readonly apiKey: string,
    private readonly environment: AsaasEnvironment = "PRODUCTION",
  ) {}

  balance() {
    return this.request<{ balance: number }>("GET", "/finance/balance");
  }

  createCustomer(data: AsaasCustomerInput) {
    return this.request<AsaasCustomer>("POST", "/customers", data);
  }

  updateCustomer(id: string, data: AsaasCustomerInput) {
    return this.request<AsaasCustomer>("POST", `/customers/${encodeURIComponent(id)}`, data);
  }

  createPayment(data: {
    customer: string;
    billingType: AsaasBillingType;
    value: number;
    dueDate: string;
    description?: string;
    externalReference?: string;
  }) {
    return this.request<AsaasPayment>("POST", "/payments", data);
  }

  getPayment(id: string) {
    return this.request<AsaasPayment>("GET", `/payments/${encodeURIComponent(id)}`);
  }

  deletePayment(id: string) {
    return this.request<{ deleted: boolean }>("DELETE", `/payments/${encodeURIComponent(id)}`);
  }

  /** Available for PIX payments and for BOLETO payments, whose slip also carries a Pix QR code. */
  pixQrCode(paymentId: string) {
    return this.request<AsaasPixQrCode>("GET", `/payments/${encodeURIComponent(paymentId)}/pixQrCode`);
  }

  /** Boleto "linha digitavel". */
  identificationField(paymentId: string) {
    return this.request<AsaasIdentificationField>("GET", `/payments/${encodeURIComponent(paymentId)}/identificationField`);
  }

  createSubscription(data: {
    customer: string;
    billingType: AsaasBillingType;
    value: number;
    nextDueDate: string;
    cycle: "MONTHLY" | "YEARLY";
    description?: string;
    externalReference?: string;
  }) {
    return this.request<AsaasSubscription>("POST", "/subscriptions", data);
  }

  cancelSubscription(id: string) {
    return this.request<{ deleted: boolean }>("DELETE", `/subscriptions/${encodeURIComponent(id)}`);
  }

  subscriptionPayments(id: string) {
    return this.request<{ data: AsaasPayment[] }>("GET", `/subscriptions/${encodeURIComponent(id)}/payments`);
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${BASE_URLS[this.environment]}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Docject",
          access_token: this.apiKey,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new BadGatewayException("Nao foi possivel conectar ao Asaas.");
    }

    const data = (await response.json().catch(() => ({}))) as T & {
      errors?: Array<{ code?: string; description?: string }>;
    };
    if (!response.ok) {
      if (response.status === 401) throw new BadGatewayException("Chave de API do Asaas invalida.");
      const message = data.errors?.map((error) => error.description).filter(Boolean).join(" ");
      throw new BadGatewayException(message || `Asaas respondeu com status ${response.status}.`);
    }
    return data;
  }
}

/** Client for the platform owner's Asaas account, which charges the admin plans. */
export function platformAsaasClient() {
  const apiKey = process.env.ASAAS_API_KEY;
  if (!apiKey) return null;
  return new AsaasClient(apiKey, asaasEnvironment(process.env.ASAAS_ENV));
}

export function asaasEnvironment(value?: string | null): AsaasEnvironment {
  return value?.toUpperCase() === "SANDBOX" ? "SANDBOX" : "PRODUCTION";
}

export function onlyDigits(value?: string | null) {
  return (value ?? "").replace(/\D/g, "");
}

/** yyyy-mm-dd in the local calendar, never in the past. */
export function asaasDueDate(date?: Date | null) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = date && date > today ? date : today;
  return `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, "0")}-${String(due.getDate()).padStart(2, "0")}`;
}

export const PAID_PAYMENT_STATUSES = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"]);
