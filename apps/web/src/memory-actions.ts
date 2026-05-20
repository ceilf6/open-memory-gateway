import path from "node:path";
import {
  MemoryService,
  MemoryStatusSchema,
  type CaptureMemoryInput,
  type IndexedMemoryRow,
  type MemoryRecord,
  type MemoryStatus,
  type UpdateMemoryInput,
} from "@open-memory-gateway/core";

export interface MemoryActionOptions {
  rootDir: string;
}

export interface MemoryActions {
  captureMemory(input: CaptureMemoryInput): Promise<MemoryRecord>;
  listMemories(input?: { status?: MemoryStatus }): Promise<IndexedMemoryRow[]>;
  searchMemories(input: { query: string; status?: MemoryStatus }): Promise<IndexedMemoryRow[]>;
  updateMemory(id: string, input: UpdateMemoryInput): Promise<MemoryRecord>;
  approveMemory(id: string): Promise<MemoryRecord>;
  rejectMemory(id: string): Promise<MemoryRecord>;
  archiveMemory(id: string): Promise<MemoryRecord>;
  close(): void;
}

export function createMemoryActions(options: MemoryActionOptions): MemoryActions {
  const service = new MemoryService({ rootDir: options.rootDir });

  return {
    captureMemory(input: CaptureMemoryInput): Promise<MemoryRecord> {
      return service.capture(input);
    },
    listMemories(input: { status?: MemoryStatus } = {}): Promise<IndexedMemoryRow[]> {
      return service.list(input.status);
    },
    searchMemories(input: { query: string; status?: MemoryStatus }): Promise<IndexedMemoryRow[]> {
      return service.search(input.query, input.status);
    },
    updateMemory(id: string, input: UpdateMemoryInput): Promise<MemoryRecord> {
      return service.update(id, input);
    },
    approveMemory(id: string): Promise<MemoryRecord> {
      return service.approve(id);
    },
    rejectMemory(id: string): Promise<MemoryRecord> {
      return service.reject(id);
    },
    archiveMemory(id: string): Promise<MemoryRecord> {
      return service.archive(id);
    },
    close(): void {
      service.close();
    },
  };
}

export function createDefaultMemoryActions(): MemoryActions {
  return createMemoryActions({ rootDir: defaultMemoryRoot() });
}

export async function withMemoryActions<T>(callback: (actions: MemoryActions) => Promise<T>): Promise<T> {
  const actions = createDefaultMemoryActions();
  try {
    return await callback(actions);
  } finally {
    actions.close();
  }
}

export function parseOptionalStatus(value: string | null | undefined): MemoryStatus | undefined {
  if (!value || value === "all") {
    return undefined;
  }

  return MemoryStatusSchema.parse(value);
}

function defaultMemoryRoot(): string {
  return process.env.OPEN_MEMORY_ROOT ?? path.join(process.cwd(), ".open-memory");
}
