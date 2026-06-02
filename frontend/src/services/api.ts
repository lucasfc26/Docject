const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";

const CONSENT_KEY = "projectfy-consent";

export function apiAssetUrl(url: string) {
  const value = url.trim();
  if (!value) return value;

  const apiBase = new URL(API_URL, window.location.origin);
  const assetOrigin = new URL(apiBase.pathname.replace(/\/api\/?$/, "/"), apiBase.origin);

  try {
    const parsed = new URL(value, window.location.origin);
    if (parsed.pathname.startsWith("/uploads/")) {
      return new URL(`${parsed.pathname}${parsed.search}${parsed.hash}`, assetOrigin).toString();
    }
    return parsed.toString();
  } catch {
    return value;
  }
}

export async function downloadApiAsset(url: string, filename?: string) {
  const href = apiAssetUrl(url);
  const response = await fetch(href);
  await assertOk(response, "Erro ao baixar arquivo");
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename ?? filenameFromUrl(href);
  link.rel = "noopener noreferrer";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

/** Lança erro se o usuário ainda não deu consentimento de dados. */
function assertConsent() {
  const status = localStorage.getItem(CONSENT_KEY);
  if (status !== "accepted") {
    throw new Error(
      "É necessário aceitar os Termos de Uso e a Política de Privacidade para continuar.",
    );
  }
}

type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    clientId?: string;
  };
};

let memoryToken = localStorage.getItem("projectfy-access-token");

export async function login(email: string, password: string) {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: normalizeEmail(email), password }),
  });
  await assertOk(response, "Credenciais invalidas");
  const data = (await response.json()) as LoginResponse;
  memoryToken = data.accessToken;
  localStorage.setItem("projectfy-access-token", data.accessToken);
  localStorage.setItem("projectfy-refresh-token", data.refreshToken);
  localStorage.setItem("projectfy-user", JSON.stringify(data.user));
  return data;
}

export async function registerUser(
  name: string,
  email: string,
  password: string,
) {
  const response = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email: normalizeEmail(email), password }),
  });
  await assertOk(response, "Nao foi possivel cadastrar usuario");
  const data = (await response.json()) as LoginResponse;
  memoryToken = data.accessToken;
  localStorage.setItem("projectfy-access-token", data.accessToken);
  localStorage.setItem("projectfy-refresh-token", data.refreshToken);
  localStorage.setItem("projectfy-user", JSON.stringify(data.user));
  return data;
}

export async function requestPasswordReset(email: string) {
  const response = await fetch(`${API_URL}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: normalizeEmail(email) }),
  });
  await assertOk(response, "Nao foi possivel iniciar a recuperacao de acesso");
  return response.json() as Promise<{ ok: boolean; email: string; mode?: string }>;
}

export async function resetPassword(email: string, password: string) {
  const response = await fetch(`${API_URL}/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: normalizeEmail(email), password }),
  });
  await assertOk(response, "Nao foi possivel alterar a senha");
  return response.json() as Promise<{ ok: boolean }>;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function filenameFromUrl(url: string) {
  const pathname = new URL(url, window.location.origin).pathname;
  return pathname.split("/").pop() || "contrato.pdf";
}

export function logout() {
  memoryToken = null;
  localStorage.removeItem("projectfy-access-token");
  localStorage.removeItem("projectfy-refresh-token");
  localStorage.removeItem("projectfy-user");
}

export async function apiGet<T>(path: string): Promise<T> {
  assertConsent();
  await ensureToken();
  const response = await fetch(`${API_URL}${path}`, {
    headers: memoryToken
      ? { Authorization: `Bearer ${memoryToken}` }
      : undefined,
  });
  await assertOk(response, `Erro ao carregar ${path}`);
  return response.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  assertConsent();
  await ensureToken();
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(memoryToken ? { Authorization: `Bearer ${memoryToken}` } : {}),
    },
    body: JSON.stringify(body),
  });
  await assertOk(response, `Erro ao criar registro em ${path}`);
  return response.json() as Promise<T>;
}

export async function apiUploadContractPdf(file: File): Promise<ApiFileUpload> {
  assertConsent();
  await ensureToken();
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${API_URL}/uploads/contracts`, {
    method: "POST",
    headers: memoryToken
      ? { Authorization: `Bearer ${memoryToken}` }
      : undefined,
    body: formData,
  });
  await assertOk(response, "Erro ao enviar contrato em PDF");
  return response.json() as Promise<ApiFileUpload>;
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  assertConsent();
  await ensureToken();
  const response = await fetch(`${API_URL}${path}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(memoryToken ? { Authorization: `Bearer ${memoryToken}` } : {}),
    },
    body: JSON.stringify(body),
  });
  await assertOk(response, `Erro ao atualizar registro em ${path}`);
  return response.json() as Promise<T>;
}

export async function apiDelete<T>(path: string): Promise<T> {
  assertConsent();
  await ensureToken();
  const response = await fetch(`${API_URL}${path}`, {
    method: "DELETE",
    headers: memoryToken
      ? { Authorization: `Bearer ${memoryToken}` }
      : undefined,
  });
  await assertOk(response, `Erro ao remover registro em ${path}`);
  return response.json() as Promise<T>;
}

export async function apiValidateContract(code: string): Promise<ApiContract> {
  const response = await fetch(`${API_URL}/contracts/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  await assertOk(response, "Senha de validacao invalida");
  return response.json() as Promise<ApiContract>;
}

async function assertOk(response: Response, fallback: string) {
  if (response.ok) return;

  try {
    const data = (await response.clone().json()) as {
      message?: string | string[];
      error?: string;
    };
    const message = Array.isArray(data.message)
      ? data.message.join(" ")
      : data.message;
    throw new Error(message || data.error || fallback);
  } catch (error) {
    if (error instanceof Error && error.name === "Error") throw error;
    throw new Error(fallback);
  }
}

async function ensureToken() {
  if (memoryToken) return;
  const refreshToken = localStorage.getItem("projectfy-refresh-token");
  if (refreshToken) {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (response.ok) {
      const data = (await response.json()) as { accessToken: string };
      memoryToken = data.accessToken;
      localStorage.setItem("projectfy-access-token", data.accessToken);
      return;
    }
  }

  if (import.meta.env.DEV) {
    await login("admin@projectfy.io", "projectfy");
  }
}

export type ApiClient = {
  id: string;
  name: string;
  segment?: string;
  health: string;
  document?: string;
  cpf?: string;
  revenue: string;
  projects?: unknown[];
  services?: unknown[];
};

export type ApiUser = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  cpf?: string;
  address?: string;
  role: string;
  clientId?: string;
  adminId?: string;
  client?: ApiClient;
};

export type ApiProject = {
  id: string;
  name: string;
  budget: string;
  status: string;
  progress: number;
  clientId?: string;
  client?: { id?: string; name: string };
  modules?: Array<{
    id: string;
    name: string;
    progress: number;
    orderIndex: number;
    businessDays?: number;
    startDate?: string;
    endDate?: string;
    value?: string;
    completed?: boolean;
    completedAt?: string;
    milestones?: Array<{
      id: string;
      title: string;
      dueDate?: string;
      completed: boolean;
    }>;
  }>;
};

export type ApiService = {
  id: string;
  name: string;
  description?: string;
  frontendHealth?: string;
  backendHealth?: string;
  databaseHealth?: string;
  healthChecks?: ApiServiceHealthCheck[];
  notes?: string;
  monthlyValue: string;
  paymentDay: number;
  startDate: string;
  active: boolean;
  clientId: string;
  client?: { id?: string; name: string };
  transactions?: ApiTransaction[];
};

export type ApiServiceHealthCheck = {
  id?: string;
  name: string;
  address: string;
};

export type ApiServiceHealthCheckResult = ApiServiceHealthCheck & {
  status: "FAST" | "SLOW" | "OFFLINE";
  responseTimeMs: number | null;
  checkedAt: string;
};

export type ApiContract = {
  id: string;
  title: string;
  value: string;
  status: string;
  clientId?: string;
  client?: { id?: string; name: string };
  contractingPartyId?: string;
  contractingParty?: { id: string; name: string; email: string; role: string; cpf?: string };
  contractorId?: string;
  contractor?: { id: string; name: string; email: string; role: string; cpf?: string };
  witnessOneId?: string;
  witnessOne?: { id: string; name: string; email: string; role: string; cpf?: string };
  witnessTwoId?: string;
  witnessTwo?: { id: string; name: string; email: string; role: string; cpf?: string };
  contractingPartySignedAt?: string;
  contractorSignedAt?: string;
  witnessOneSignedAt?: string;
  witnessTwoSignedAt?: string;
  originalDocumentHash?: string;
  signedDocumentHash?: string;
  signedFileUrl?: string;
  validationCodeHash?: string;
  sentAt?: string;
  cancelledAt?: string;
  signatureLogs?: ApiContractSignatureLog[];
  versions: Array<{ version: number; fileUrl?: string }>;
};

export type ApiContractSignatureLog = {
  id: string;
  role: string;
  signerName: string;
  signerEmail?: string;
  signerCpf?: string;
  ipAddress?: string;
  tokenHash?: string;
  documentHash?: string;
  signedAt: string;
};

export type ApiFileUpload = {
  id: string;
  filename: string;
  url: string;
  mimeType?: string;
  createdAt: string;
};

export type ApiFeature = {
  id: string;
  name: string;
  path: string;
  orderIndex: number;
  role: string;
};

export type ApiTransaction = {
  id: string;
  entity: string;
  amount: string;
  kind: string;
  status: string;
  dueDate?: string;
  moduleId?: string;
  module?: {
    id: string;
    name: string;
    orderIndex: number;
    completedAt?: string;
    project?: { name: string; client?: { name: string } };
  };
  serviceId?: string;
  servicePeriod?: string;
  service?: {
    id: string;
    name: string;
    client?: { name: string };
  };
};

export type ApiAppointment = {
  id: string;
  title: string;
  client?: string;
  location?: string;
  startsAt: string;
  endsAt?: string;
  notes?: string;
};

export type ApiResource = {
  id: string;
  name: string;
  role: string;
  capacity: number;
};

export type ApiSettings = {
  id: string;
  appName: string;
  timezone: string;
  currency: string;
  supportPhone?: string;
};
