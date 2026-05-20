import type { CaptureMemoryInput, MemoryStatus } from "@open-memory-gateway/core";

export interface MemoryCaptureResult {
  id: string;
  status: MemoryStatus;
}

export interface MemoryCaptureAdapter {
  readonly name: string;
  capture(input: CaptureMemoryInput): Promise<MemoryCaptureResult>;
}

export function defineMemoryCaptureAdapter(adapter: MemoryCaptureAdapter): MemoryCaptureAdapter {
  return adapter;
}
