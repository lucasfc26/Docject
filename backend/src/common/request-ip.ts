import type { Request } from "express";

function firstHeader(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0]?.trim() : value?.trim();
}

function isPrivateIp(ip: string) {
  if (!ip) return true;
  const normalized = ip.replace(/^\[|\]$/g, "");
  if (normalized === "::1" || normalized === "127.0.0.1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:")) return true;

  const parts = normalized.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return false;

  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 127) return true;
  return false;
}

function pickPublicIp(candidates: string[]) {
  return candidates.find((ip) => ip && !isPrivateIp(ip)) ?? candidates.find(Boolean);
}

export function requestIp(request: Pick<Request, "headers" | "ip" | "socket">) {
  const realIp = firstHeader(request.headers["x-real-ip"]);
  if (realIp && !isPrivateIp(realIp)) return realIp;

  const forwarded = firstHeader(request.headers["x-forwarded-for"]);
  if (forwarded) {
    const chain = forwarded.split(",").map((ip) => ip.trim()).filter(Boolean);
    const publicIp = pickPublicIp(chain);
    if (publicIp) return publicIp;
  }

  if (realIp) return realIp;
  if (request.ip && !isPrivateIp(request.ip)) return request.ip;

  const remote = request.socket?.remoteAddress?.replace(/^::ffff:/, "");
  if (remote && !isPrivateIp(remote)) return remote;

  return request.ip ?? remote ?? forwarded?.split(",")[0]?.trim();
}

export function requestUserAgent(request: Pick<Request, "headers">) {
  return firstHeader(request.headers["user-agent"]);
}
