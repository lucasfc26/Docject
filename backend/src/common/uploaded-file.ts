import { unlink } from "node:fs/promises";
import { join } from "node:path";

const ATTACHMENT_PREFIXES = ["/uploads/attachments/", "/uploads/projects/", "/uploads/services/"];

export async function deleteUploadedAttachment(fileUrl?: string | null) {
  if (!fileUrl) return;
  try {
    const pathname = fileUrl.startsWith("http") ? new URL(fileUrl).pathname : fileUrl;
    const prefix = ATTACHMENT_PREFIXES.find((item) => pathname.startsWith(item));
    if (!prefix) return;
    const filename = pathname.split("/").pop();
    if (!filename) return;
    const folder = prefix.replace(/^\/+|\/+$/g, "").split("/");
    await unlink(join(process.cwd(), ...folder, filename));
  } catch {
    return;
  }
}

export function emptyToNull(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
