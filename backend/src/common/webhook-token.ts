import { timingSafeEqual } from "crypto";

/** Constant-time comparison of the `asaas-access-token` header with the expected token. */
export function webhookTokenMatches(received: unknown, expected?: string | null) {
  if (!expected || typeof received !== "string") return false;
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}
