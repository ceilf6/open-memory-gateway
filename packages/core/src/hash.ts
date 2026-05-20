import { createHash } from "node:crypto";

export function normalizeContentForHash(content: string): string {
  return content.trim().replace(/\s+/g, " ");
}

export function hashMemoryContent(content: string): string {
  return createHash("sha256").update(normalizeContentForHash(content)).digest("hex");
}
