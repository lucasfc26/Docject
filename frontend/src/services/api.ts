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
  return response.json() as Promise<{ ok: boolean; message: string }>;
}

export async function resetPassword(email: string, code: string, password: string) {
  const response = await fetch(`${API_URL}/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: normalizeEmail(email), code, password }),
  });
  await assertOk(response, "Nao foi possivel alterar a senha");
  return response.json() as Promise<{ ok: boolean }>;
}

export async function changePassword(currentPassword: string, password: string) {
  const response = await authFetch("/auth/change-password", jsonRequest("POST", { currentPassword, password }));
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
  const response = await authFetch(path);
  await assertOk(response, `Erro ao carregar ${path}`);
  return response.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const response = await authFetch(path, jsonRequest("POST", body));
  await assertOk(response, `Erro ao criar registro em ${path}`);
  return response.json() as Promise<T>;
}

export async function apiResetUserPassword(userId: string) {
  return apiPost<{ ok: boolean; email: string }>(`/users/${userId}/reset-password`, {});
}

export async function apiUploadContractPdf(file: File): Promise<ApiFileUpload> {
  const response = await authFetch("/uploads/contracts", fileRequest(file));
  await assertOk(response, "Erro ao enviar contrato em PDF");
  return response.json() as Promise<ApiFileUpload>;
}

export async function apiUploadAttachment(file: File): Promise<ApiFileUpload> {
  const response = await authFetch("/uploads/attachments", fileRequest(file));
  await assertOk(response, "Erro ao enviar arquivo ZIP do projeto");
  return response.json() as Promise<ApiFileUpload>;
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const response = await authFetch(path, jsonRequest("PATCH", body));
  await assertOk(response, `Erro ao atualizar registro em ${path}`);
  return response.json() as Promise<T>;
}

export async function apiDelete<T>(path: string): Promise<T> {
  const response = await authFetch(path, { method: "DELETE" });
  await assertOk(response, `Erro ao remover registro em ${path}`);
  return response.json() as Promise<T>;
}

function jsonRequest(method: string, body: unknown): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

function fileRequest(file: File): RequestInit {
  const formData = new FormData();
  formData.append("file", file);
  return { method: "POST", body: formData };
}

/**
 * Authenticated request: renews the access token shortly before it expires and, if the API
 * still answers 401, renews once more and repeats the request.
 */
async function authFetch(path: string, init: RequestInit = {}) {
  assertConsent();
  await ensureToken();
  const send = (token: string | null) =>
    fetch(`${API_URL}${path}`, {
      ...init,
      headers: { ...(init.headers as Record<string, string> | undefined), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
  const sentToken = memoryToken;
  const response = await send(sentToken);
  if (response.status !== 401) return response;
  await renewToken(sentToken);
  return send(memoryToken);
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

let pendingToken: Promise<void> | null = null;
const TOKEN_RENEW_MARGIN_MS = 2 * 60_000;

function ensureToken() {
  if (memoryToken && !tokenExpiresSoon(memoryToken)) return Promise.resolve();
  return renewToken(memoryToken);
}

// Shared so the requests a screen fires in parallel trigger a single refresh.
function renewToken(staleToken: string | null) {
  if (memoryToken && memoryToken !== staleToken) return Promise.resolve();
  pendingToken ??= obtainToken().finally(() => {
    pendingToken = null;
  });
  return pendingToken;
}

async function obtainToken() {
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
    if (response.status !== 401) throw new Error("Nao foi possivel renovar a sessao. Tente novamente.");
  }

  if (import.meta.env.DEV) {
    await login("admin@projectfy.io", "projectfy");
    return;
  }

  logout();
  window.location.assign("/login");
  throw new Error("Sua sessao expirou. Entre novamente.");
}

function tokenExpiresSoon(token: string) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))) as { exp?: number };
    return !payload.exp || payload.exp * 1000 - Date.now() < TOKEN_RENEW_MARGIN_MS;
  } catch {
    return true;
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
  fileUrl?: string | null;
  fileName?: string | null;
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
  monthlyHours?: string | number;
  hoursExpirePercent?: number;
  hoursExpirationMonths?: number;
  paymentDay: number;
  startDate: string;
  active: boolean;
  fileUrl?: string | null;
  fileName?: string | null;
  clientId: string;
  client?: { id?: string; name: string };
  transactions?: ApiTransaction[];
};

export type ApiServiceWorkLog = {
  id: string;
  month: string;
  hours: number;
  description: string;
  createdAt: string;
  createdBy?: { id: string; name: string } | null;
};

export type ApiServiceHoursMonth = {
  month: string;
  monthlyHours: number;
  carriedHours: number;
  expiredHours: number;
  availableHours: number;
  usedHours: number;
  remainingHours: number;
  overageHours: number;
  cohorts: Array<{ originMonth: string; hours: number }>;
  logs: ApiServiceWorkLog[];
};

export type ApiServiceHours = {
  monthlyHours: number;
  hoursExpirePercent: number;
  hoursExpirationMonths: number;
  months: ApiServiceHoursMonth[];
};

export type ApiServiceReportSummary = {
  month: string;
  status: "OPEN" | "CLOSED";
  availabilityPercent: number | null;
};

export type ApiServiceBackupStatus = "OK" | "ATTENTION" | "FAILED" | "NOT_APPLICABLE";

export type ApiServiceReport = {
  serviceId: string;
  serviceName: string;
  clientName: string | null;
  month: string;
  status: "OPEN" | "CLOSED";
  current?: boolean;
  closedAt: string | null;
  updatedAt: string | null;
  updatedBy: { id: string; name: string } | null;
  availability: {
    percent: number | null;
    samplesTotal: number;
    samplesOnline: number;
    intervalMinutes: number;
    checks: Array<{
      checkKey: string;
      checkName: string;
      samplesTotal: number;
      samplesOnline: number;
      availabilityPercent: number | null;
      downtimeMinutes: number;
      avgResponseMs: number | null;
    }>;
  };
  incidents: {
    auto: Array<{
      checkName: string;
      startedAt: string;
      endedAt: string | null;
      durationMinutes: number;
      summary: string | null;
    }>;
    notes: string | null;
  };
  backup: {
    status: ApiServiceBackupStatus | null;
    manualStatus: ApiServiceBackupStatus | null;
    summary: {
      samplesTotal: number;
      samplesOk: number;
      lastDetail: string | null;
      lastCheckedAt: string | null;
      autoStatus: ApiServiceBackupStatus | null;
    } | null;
    notes: string | null;
  };
  hours: {
    monthlyHours: number;
    usedHours: number;
    availableHours: number;
    remainingHours: number;
    overageHours: number;
    logs: ApiServiceWorkLog[];
  };
  carriedHours: {
    hours: number;
    expiredHours: number;
    cohorts: Array<{ originMonth: string; hours: number }>;
  };
  otherOccurrences: string | null;
};

export type ApiServiceHealthCheck = {
  id?: string;
  name: string;
  address: string;
};

export type ApiHealthComponent = {
  name: string;
  online: boolean;
  detail?: string;
};

export type ApiServiceHealthCheckResult = ApiServiceHealthCheck & {
  status: "FAST" | "SLOW" | "OFFLINE" | "PENDING";
  online?: boolean;
  summary?: string;
  components?: ApiHealthComponent[];
  responseTimeMs: number | null;
  checkedAt: string;
};

export type ApiContractParticipant = {
  id: string;
  role: "CONTRACTING_PARTY" | "CONTRACTOR" | "WITNESS";
  witnessIndex?: number;
  signedAt?: string;
  addedAt: string;
  user: { id: string; name: string; email: string; role: string; cpf?: string };
  addedBy?: { id: string; name: string; email: string };
};

export type ApiContractEventLog = {
  id: string;
  eventType: string;
  actorName?: string;
  actorEmail?: string;
  description: string;
  createdAt: string;
};

export type ApiContract = {
  id: string;
  title: string;
  value: string;
  status: string;
  clientId?: string;
  client?: { id?: string; name: string };
  createdBy?: { id: string; name: string; email: string };
  participants?: ApiContractParticipant[];
  eventLogs?: ApiContractEventLog[];
  originalDocumentHash?: string;
  signedDocumentHash?: string;
  signedFileUrl?: string;
  govSignedAt?: string;
  govSignedById?: string;
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
  userAgent?: string;
  latitude?: number;
  longitude?: number;
  geoAccuracy?: number;
  deviceInfo?: Partial<ContractDeviceInfo>;
  tokenHash?: string;
  documentHash?: string;
  signedAt: string;
};

export type ContractDeviceInfo = {
  platform: string;
  language: string;
  timezone: string;
  screen: string;
  pixelRatio: number;
  touchPoints: number;
};

export type ContractSignPayload = {
  password: string;
  latitude: number;
  longitude: number;
  geoAccuracy?: number;
  acceptedTerms: true;
  deviceInfo: ContractDeviceInfo;
};

export function contractParticipantLabel(
  role: ApiContractParticipant["role"],
  witnessIndex?: number,
) {
  if (role === "CONTRACTING_PARTY") return "Contratante";
  if (role === "CONTRACTOR") return "Contratado";
  if (role === "WITNESS") return witnessIndex ? `Testemunha ${witnessIndex}` : "Testemunha";
  return role;
}

export function sortedContractParticipants(contract: ApiContract) {
  const order = { CONTRACTING_PARTY: 0, CONTRACTOR: 1, WITNESS: 2 } as const;
  return [...(contract.participants ?? [])].sort((left, right) => {
    const roleDiff = order[left.role] - order[right.role];
    if (roleDiff !== 0) return roleDiff;
    return (left.witnessIndex ?? 0) - (right.witnessIndex ?? 0);
  });
}

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
