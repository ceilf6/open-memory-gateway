import { InvalidMemoryTransitionError, MemoryError, MemoryNotFoundError } from "./errors";
import { hashMemoryContent } from "./hash";
import { createMemoryId } from "./ids";
import { MarkdownMemoryStore } from "./markdown-store";
import {
  normalizeTags,
  type CaptureMemoryInput,
  type MemoryRecord,
  type MemoryStatus,
  type UpdateMemoryInput,
} from "./schema";
import { SQLiteMemoryIndex, type IndexedMemoryRow } from "./sqlite-index";

const VALID_TRANSITIONS: Record<MemoryStatus, MemoryStatus[]> = {
  draft: ["active", "rejected"],
  active: ["archived"],
  archived: [],
  rejected: [],
};

export interface MemoryServiceOptions {
  rootDir: string;
  now?: () => Date;
}

export class MemoryService {
  private readonly store: MarkdownMemoryStore;
  private readonly index: SQLiteMemoryIndex;
  private readonly now: () => Date;

  constructor(options: MemoryServiceOptions) {
    this.store = new MarkdownMemoryStore({ rootDir: options.rootDir });
    this.index = new SQLiteMemoryIndex({ rootDir: options.rootDir });
    this.now = options.now ?? (() => new Date());
  }

  async capture(input: CaptureMemoryInput): Promise<MemoryRecord> {
    const content = input.content.trim();
    if (!content) {
      throw new MemoryError("Memory content is required", "VALIDATION_ERROR");
    }

    const currentTime = this.now();
    const now = currentTime.toISOString();
    const contentHash = hashMemoryContent(content);
    const possibleDuplicate = this.index.hasContentHash(contentHash);
    const record = await this.store.write({
      frontmatter: {
        id: createMemoryId(currentTime),
        status: "draft",
        scope: input.scope ?? "personal",
        source: input.source ?? "manual",
        tags: normalizeTags(input.tags),
        createdAt: now,
        updatedAt: now,
      },
      content,
      contentHash,
      possibleDuplicate,
    });
    const indexed = { ...record, possibleDuplicate, contentHash };
    this.index.upsert(indexed);
    return indexed;
  }

  async update(id: string, input: UpdateMemoryInput): Promise<MemoryRecord> {
    const existing = await this.readOrThrowNotFound(id);
    const content = input.content === undefined ? existing.content : input.content.trim();
    if (!content) {
      throw new MemoryError("Memory content is required", "VALIDATION_ERROR");
    }

    const currentStatus = existing.frontmatter.status;
    const newStatus = input.status ?? currentStatus;
    if (newStatus !== currentStatus) {
      const allowed = VALID_TRANSITIONS[currentStatus];
      if (!allowed.includes(newStatus)) {
        throw new InvalidMemoryTransitionError(currentStatus, newStatus);
      }
    }

    const updated: MemoryRecord = {
      frontmatter: {
        ...existing.frontmatter,
        status: input.status ?? existing.frontmatter.status,
        scope: input.scope ?? existing.frontmatter.scope,
        source: input.source ?? existing.frontmatter.source,
        tags: input.tags ? normalizeTags(input.tags) : existing.frontmatter.tags,
        updatedAt: this.now().toISOString(),
      },
      content,
      contentHash: hashMemoryContent(content),
    };

    const record = await this.store.write(updated);
    await this.rebuildIndex();
    return this.withIndexedDuplicateFlag(record);
  }

  async approve(id: string): Promise<MemoryRecord> {
    return this.update(id, { status: "active" });
  }

  async reject(id: string): Promise<MemoryRecord> {
    return this.update(id, { status: "rejected" });
  }

  async archive(id: string): Promise<MemoryRecord> {
    return this.update(id, { status: "archived" });
  }

  async list(status?: MemoryStatus): Promise<IndexedMemoryRow[]> {
    return this.index.list(status);
  }

  async search(query: string, status?: MemoryStatus): Promise<IndexedMemoryRow[]> {
    return this.index.search(query, status);
  }

  async rebuildIndex(): Promise<number> {
    const records = await this.store.list();
    const indexedRecords = this.withDuplicateFlags(records);

    this.index.clear();
    for (const record of indexedRecords) {
      this.index.upsert(record);
    }
    return indexedRecords.length;
  }

  close(): void {
    this.index.close();
  }

  private withDuplicateFlags(records: MemoryRecord[]): MemoryRecord[] {
    const counts = new Map<string, number>();
    const recordsWithHashes = records.map((record) => ({
      ...record,
      contentHash: record.contentHash ?? hashMemoryContent(record.content),
    }));

    for (const record of recordsWithHashes) {
      counts.set(record.contentHash, (counts.get(record.contentHash) ?? 0) + 1);
    }

    return recordsWithHashes.map((record) => ({
      ...record,
      possibleDuplicate: (counts.get(record.contentHash) ?? 0) > 1,
    }));
  }

  private withIndexedDuplicateFlag(record: MemoryRecord): MemoryRecord {
    const indexed = this.index
      .list(record.frontmatter.status)
      .find((row) => row.id === record.frontmatter.id);

    return {
      ...record,
      contentHash: indexed?.contentHash ?? record.contentHash,
      possibleDuplicate: indexed?.possibleDuplicate ?? false,
    };
  }

  private async readOrThrowNotFound(id: string): Promise<MemoryRecord> {
    try {
      return await this.store.read(id);
    } catch (error) {
      if (error instanceof Error && error.message.includes("Memory not found")) {
        throw new MemoryNotFoundError(id);
      }
      throw error;
    }
  }
}
