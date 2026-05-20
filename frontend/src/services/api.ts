const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";

const CONSENT_KEY = "projectfy-consent";

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

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
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
  revenue: string;
  projects?: unknown[];
  services?: unknown[];
};

export type ApiUser = {
  id: string;
  name: string;
  email: string;
  phone?: string;
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
  notes?: string;
  monthlyValue: string;
  paymentDay: number;
  startDate: string;
  active: boolean;
  clientId: string;
  client?: { id?: string; name: string };
  transactions?: ApiTransaction[];
};

export type ApiContract = {
  id: string;
  title: string;
  value: string;
  status: string;
  clientId?: string;
  client?: { id?: string; name: string };
  versions: Array<{ version: number; fileUrl?: string }>;
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
