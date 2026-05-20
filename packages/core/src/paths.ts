import path from "node:path";
import type { MemoryStatus } from "./schema";

export interface MemoryPaths {
  rootDir: string;
}

export function memoryBaseDir(rootDir: string): string {
  return path.join(rootDir, "memory");
}

export function statusDirName(status: MemoryStatus): string {
  if (status === "active") return "active";
  if (status === "archived") return "archived";
  return "inbox";
}

export function memoryFilePath(rootDir: string, status: MemoryStatus, id: string): string {
  return path.join(memoryBaseDir(rootDir), statusDirName(status), `${id}.md`);
}

export function memoryIndexPath(rootDir: string): string {
  return path.join(memoryBaseDir(rootDir), ".index", "memory.sqlite");
}
