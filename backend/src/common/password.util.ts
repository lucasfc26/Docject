import { randomBytes } from "node:crypto";

const specials = "!@#$%&*";

export function generateRandomPassword(length = 12) {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const pool = letters + digits + specials;
  const bytes = randomBytes(length);
  const chars = Array.from(bytes, (byte) => pool[byte % pool.length]);
  chars[0] = letters[bytes[0] % letters.length];
  chars[1] = digits[bytes[1] % digits.length];
  chars[2] = specials[bytes[2] % specials.length];
  return chars.join("");
}
