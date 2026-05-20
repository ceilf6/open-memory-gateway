import { randomBytes } from "node:crypto";

export function createMemoryId(now = new Date()): string {
  const yyyymmdd = now.toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = randomBytes(4).toString("hex");
  return `mem_${yyyymmdd}_${suffix}`;
}
