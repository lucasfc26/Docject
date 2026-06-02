import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { connect } from "node:net";
import { URL } from "node:url";
import { AuthenticatedRequest, serviceScope } from "../../common/current-user";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateServiceDto, UpdateServiceDto } from "./dto/service.dto";
import { syncDueServicePayments, syncOneServicePayments } from "./services.billing";

type ServiceHealthCheck = {
  id?: string;
  name: string;
  address: string;
};

@ApiTags("services")
@Controller("services")
export class ServicesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async findAll(@Req() request: AuthenticatedRequest) {
    await syncDueServicePayments(this.prisma);
    return this.prisma.service.findMany({
      where: serviceScope(request.user),
      include: { client: true, transactions: { orderBy: { dueDate: "desc" } } },
      orderBy: { createdAt: "desc" }
    });
  }

  @Get(":id/health-checks")
  async checkHealth(@Param("id") id: string) {
    const service = await this.prisma.service.findUnique({
      where: { id },
      select: { healthChecks: true }
    });
    const checks = sanitizeHealthChecks(service?.healthChecks);
    const results = await Promise.all(checks.map(checkServiceHealth));
    return results;
  }

  @Post()
  async create(@Body() body: CreateServiceDto) {
    const service = await this.prisma.service.create({
      data: { ...body, startDate: new Date(body.startDate) } as never,
      include: { client: true }
    });
    await syncOneServicePayments(this.prisma, service.id);
    return service;
  }

  @Patch(":id")
  async update(@Param("id") id: string, @Body() body: UpdateServiceDto) {
    const service = await this.prisma.service.update({
      where: { id },
      data: { ...body, startDate: body.startDate ? new Date(body.startDate) : undefined } as never,
      include: { client: true }
    });
    await syncOneServicePayments(this.prisma, service.id);
    return service;
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.prisma.service.delete({ where: { id } });
  }
}

function sanitizeHealthChecks(value: unknown): ServiceHealthCheck[] {
  if (!Array.isArray(value)) return [];
  const checks: ServiceHealthCheck[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as Record<string, unknown>;
    const name = String(candidate.name ?? "").trim();
    const address = String(candidate.address ?? "").trim();
    const id = String(candidate.id ?? "").trim();
    if (!name || !address) continue;
    checks.push({ id: id || undefined, name, address });
  }
  return checks;
}

async function checkServiceHealth(check: ServiceHealthCheck) {
  const startedAt = performance.now();
  try {
    await probeAddress(check.address, 5000);
    const responseTimeMs = Math.round(performance.now() - startedAt);
    return {
      ...check,
      status: responseTimeMs <= 800 ? "FAST" : "SLOW",
      responseTimeMs,
      checkedAt: new Date().toISOString()
    };
  } catch {
    return {
      ...check,
      status: "OFFLINE",
      responseTimeMs: null,
      checkedAt: new Date().toISOString()
    };
  }
}

async function probeAddress(address: string, timeoutMs: number) {
  const candidates = parseAddressCandidates(address);
  let lastError: unknown;

  for (const parsed of candidates) {
    try {
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        await probeHttp(parsed.href, timeoutMs);
      } else {
        await probeTcp(parsed.hostname, parsed.port, timeoutMs);
      }
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Health check failed");
}

async function probeHttp(href: string, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(href, {
      method: "HEAD",
      signal: controller.signal
    });
    if (!response.ok && response.status >= 500) {
      throw new Error("Unhealthy HTTP response");
    }
  } finally {
    clearTimeout(timeout);
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
