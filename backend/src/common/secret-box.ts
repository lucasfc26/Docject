import { InternalServerErrorException } from "@nestjs/common";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const VERSION = "v1";

/**
 * AES-256-GCM key from CREDENTIALS_ENCRYPTION_KEY (64 hex chars). Any other string is
 * stretched with SHA-256 so local setups keep working, but production must set a random key.
 */
function encryptionKey() {
  const raw = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      throw new InternalServerErrorException("CREDENTIALS_ENCRYPTION_KEY nao configurada.");
    }
    return createHash("sha256").update(process.env.JWT_SECRET ?? "local-dev-secret").digest();
  }
  return /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : createHash("sha256").update(raw).digest();
}

/** Returns `v1:<iv>:<tag>:<ciphertext>` in base64 parts. */
export function encryptSecret(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(":");
}

export function decryptSecret(payload: string) {
  const [version, iv, tag, encrypted] = payload.split(":");
  if (version !== VERSION || !iv || !tag || !encrypted) {
    throw new InternalServerErrorException("Segredo cifrado em formato invalido.");
  }
  const decipher = createDecipheriv(ALGORITHM, encryptionKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64")), decipher.final()]).toString("utf8");
}
