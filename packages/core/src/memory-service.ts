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
      throw new Error("Memory content is required");
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
    const existing = await this.store.read(id);
    const content = input.content?.trim() ?? existing.content;
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
    this.index.upsert(record);
    return record;
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
    this.index.clear();
    const records = await this.store.list();
    for (const record of records) {
      this.index.upsert(record);
    }
    return records.length;
  }

  close(): void {
    this.index.close();
  }
}
