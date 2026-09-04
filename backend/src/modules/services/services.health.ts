import { connect } from "node:net";
import { URL } from "node:url";

export type ServiceHealthCheck = {
  id?: string;
  name: string;
  address: string;
};

export type HealthComponent = {
  name: string;
  online: boolean;
  detail?: string;
};

export type HealthCheckResult = ServiceHealthCheck & {
  status: "FAST" | "SLOW" | "OFFLINE";
  online: boolean;
  summary: string;
  components: HealthComponent[];
  responseTimeMs: number | null;
  checkedAt: string;
};

export function sanitizeHealthChecks(value: unknown): ServiceHealthCheck[] {
  if (!Array.isArray(value)) return [];
  const checks: ServiceHealthCheck[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as Record<string, unknown>;
    const name = String(candidate.name ?? "").trim();
    const address = extractHttpUrl(String(candidate.address ?? "").trim()) || String(candidate.address ?? "").trim();
    const id = String(candidate.id ?? "").trim();
    if (!name || !address) continue;
    checks.push({ id: id || undefined, name, address });
  }
  return checks;
}

export async function checkServiceHealth(check: ServiceHealthCheck): Promise<HealthCheckResult> {
  const startedAt = performance.now();
  try {
    const probe = await probeAddress(check.address, 8000);
    const responseTimeMs = Math.round(performance.now() - startedAt);
    const speed = responseTimeMs <= 800 ? "FAST" : "SLOW";
    const parsed = interpretProbe(check, probe);
    return {
      ...check,
      status: speed,
      online: parsed.online,
      summary: parsed.summary,
      components: parsed.components,
      responseTimeMs,
      checkedAt: new Date().toISOString()
    };
  } catch {
    return {
      ...check,
      status: "OFFLINE",
      online: false,
      summary: "Offline",
      components: [],
      responseTimeMs: null,
      checkedAt: new Date().toISOString()
    };
  }
}

type HttpProbe = {
  kind: "http";
  href: string;
  statusCode: number;
  body: string;
};

type TcpProbe = {
  kind: "tcp";
};

type ProbeResult = HttpProbe | TcpProbe;

function interpretProbe(check: ServiceHealthCheck, probe: ProbeResult) {
  if (probe.kind === "tcp") {
    return { online: true, summary: "Online", components: [] as HealthComponent[] };
  }

  const json = parseJson(probe.body);
  if (isDetailedHealth(json)) {
    return interpretDetailedHealth(json);
  }
  if (isApiHealth(check, probe, json)) {
    return interpretApiHealth(probe.statusCode, json);
  }

  const online = probe.statusCode < 500;
  return {
    online,
    summary: online ? "Online" : "Offline",
    components: [] as HealthComponent[]
  };
}

function isApiHealth(check: ServiceHealthCheck, probe: HttpProbe, json: Record<string, unknown> | null) {
  const haystack = `${check.name} ${probe.href}`.toLowerCase();
  if (haystack.includes("/health/detailed")) return false;
  if (json && typeof json.status === "string") return true;
  return haystack.includes("/api/health") || /\b(api|banco|postgres|database)\b/.test(haystack);
}

function isDetailedHealth(json: Record<string, unknown> | null): json is Record<string, unknown> {
  if (!json) return false;
  return Boolean(json.backend || json.database || json.extrator || json.backups);
}

function interpretApiHealth(statusCode: number, json: Record<string, unknown> | null) {
  const status = String(json?.status ?? "").toLowerCase();
  const healthy = statusCode < 400 && (status === "ok" || status === "up" || status === "healthy");

  if (healthy) {
    return {
      online: true,
      summary: "API e Postgres ok",
      components: [
        { name: "API", online: true },
        { name: "Postgres", online: true }
      ]
    };
  }

  if (statusCode === 503 || status === "error" || status === "down") {
    return {
      online: false,
      summary: "Banco de dados offline",
      components: [
        { name: "API", online: (statusCode > 0 && statusCode < 500) || statusCode === 503 },
        { name: "Postgres", online: false }
      ]
    };
  }

  if (statusCode < 400) {
    return {
      online: true,
      summary: "Online",
      components: [] as HealthComponent[]
    };
  }

  return {
    online: false,
    summary: "Offline",
    components: [
      { name: "API", online: false },
      { name: "Postgres", online: false }
    ]
  };
}

function interpretDetailedHealth(json: Record<string, unknown>) {
  const backend = asRecord(json.backend);
  const database = asRecord(json.database);
  const extrator = asRecord(json.extrator);
  const backups = asRecord(json.backups);
  const daily = asRecord(backups?.daily);
  const lastBackup = daily?.ultimoBackup ? String(daily.ultimoBackup) : "";
  const components: HealthComponent[] = [
    {
      name: "Backend",
      online: isUp(backend?.status),
      detail: backendDetail(backend)
    },
    {
      name: "Banco de dados",
      online: isUp(database?.status),
      detail: latencyDetail(database?.latenciaMs)
    },
    {
      name: "Extrator",
      online: isUp(extrator?.status),
      detail: latencyDetail(extrator?.latenciaMs)
    },
    {
      name: "Backups",
      online: Boolean(lastBackup),
      detail: lastBackup ? `Ultimo: ${formatDate(lastBackup)}` : "Sem backup diario"
    }
  ];
  const online = components.filter((item) => item.name !== "Backups").every((item) => item.online);
  return {
    online,
    summary: online ? "Backend, banco e extrator ok" : "Algum servico interno esta offline",
    components
  };
}

function backendDetail(backend?: Record<string, unknown>) {
  const uptime = Number(backend?.uptimeSegundos);
  if (!Number.isFinite(uptime) || uptime < 0) return undefined;
  return `Uptime ${formatUptime(uptime)}`;
}

function latencyDetail(value: unknown) {
  const latency = Number(value);
  if (!Number.isFinite(latency)) return undefined;
  return `${Math.round(latency)} ms`;
}

function formatUptime(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  return `${hours}h ${minutes}m`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR");
}

function isUp(value: unknown) {
  const status = String(value ?? "").toLowerCase();
  return status === "up" || status === "ok" || status === "healthy" || status === "online";
}

function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function extractHttpUrl(value: string) {
  const match = value.match(/https?:\/\/[^\s]+/i);
  return match ? match[0].replace(/[.,;)]+$/g, "") : "";
}

function parseJson(body: string) {
  if (!body.trim()) return null;
  try {
    const parsed = JSON.parse(body) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function probeAddress(address: string, timeoutMs: number): Promise<ProbeResult> {
  const candidates = parseAddressCandidates(extractHttpUrl(address) || address);
  let lastError: unknown;

  for (const parsed of candidates) {
    try {
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return await probeHttp(parsed.href, timeoutMs);
      }
      await probeTcp(parsed.hostname, parsed.port, timeoutMs);
      return { kind: "tcp" };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Health check failed");
}

async function probeHttp(href: string, timeoutMs: number): Promise<HttpProbe> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(href, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "application/json, text/plain, */*"
      }
    });
    const contentType = response.headers.get("content-type") ?? "";
    const pathname = safePathname(href);
    const shouldReadBody = contentType.includes("json") || pathname.includes("health");
    const body = shouldReadBody ? await readBody(response, 64_000) : "";
    return {
      kind: "http",
      href,
      statusCode: response.status,
      body
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function readBody(response: Response, maxBytes: number) {
  const text = await response.text();
  return text.length > maxBytes ? text.slice(0, maxBytes) : text;
}

function safePathname(href: string) {
  try {
    return new URL(href).pathname.toLowerCase();
  } catch {
    return href.toLowerCase();
  }
}

function parseAddressCandidates(address: string) {
  const value = address.trim();
  if (hasProtocol(value)) return [parseAddress(value)];
  if (hasExplicitPort(value)) return [parseAddress(`tcp://${value}`)];
  return [parseAddress(`https://${value}`), parseAddress(`http://${value}`)];
}

function parseAddress(value: string) {
  const parsed = new URL(value);
  const protocol = parsed.protocol;
  const defaultPort = protocol === "https:" ? 443 : protocol === "http:" ? 80 : undefined;
  const port = Number(parsed.port || defaultPort);
  if (!parsed.hostname || !port) {
    throw new Error("Invalid health check address");
  }
  return {
    protocol,
    href: parsed.href,
    hostname: parsed.hostname,
    port
  };
}

function hasProtocol(value: string) {
  return /^[a-z][a-z\d+\-.]*:\/\//i.test(value);
}

function hasExplicitPort(value: string) {
  try {
    return Boolean(new URL(`tcp://${value}`).port);
  } catch {
    return false;
  }
}

function probeTcp(host: string, port: number, timeoutMs: number) {
  return new Promise<void>((resolve, reject) => {
    const socket = connect({ host, port });
    const fail = (error: Error) => {
      socket.destroy();
      reject(error);
    };
    socket.setTimeout(timeoutMs, () => fail(new Error("Timeout")));
    socket.once("error", fail);
    socket.once("connect", () => {
      socket.end();
      resolve();
    });
  });
}
