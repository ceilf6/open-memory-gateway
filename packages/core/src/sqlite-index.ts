import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { memoryIndexPath } from "./paths";
import type { MemoryRecord, MemoryStatus } from "./schema";

export interface SQLiteMemoryIndexOptions {
  rootDir: string;
}

export interface IndexedMemoryRow {
  id: string;
  status: MemoryStatus;
  scope: string;
  source: string;
  tags: string[];
  contentHash: string;
  possibleDuplicate: boolean;
  createdAt: string;
  updatedAt: string;
  path: string;
  searchText: string;
}

type RawMemoryRow = {
  id: string;
  status: MemoryStatus;
  scope: string;
  source: string;
  tags: string;
  content_hash: string;
  possible_duplicate: 0 | 1;
  created_at: string;
  updated_at: string;
  path: string;
  search_text: string;
};

function escapeLikePattern(query: string): string {
  return query.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export class SQLiteMemoryIndex {
  private readonly db: Database.Database;

  constructor(options: SQLiteMemoryIndexOptions) {
    const sqlitePath = memoryIndexPath(options.rootDir);
    mkdirSync(path.dirname(sqlitePath), { recursive: true });
    this.db = new Database(sqlitePath);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        scope TEXT NOT NULL,
        source TEXT NOT NULL,
        tags TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        possible_duplicate INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        path TEXT NOT NULL,
        search_text TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_memories_status ON memories(status);
      CREATE INDEX IF NOT EXISTS idx_memories_content_hash ON memories(content_hash);
    `);
  }

  upsert(record: MemoryRecord): IndexedMemoryRow {
    if (!record.path || !record.contentHash) {
      throw new Error("Indexed memory records require path and contentHash");
    }

    const row: IndexedMemoryRow = {
      id: record.frontmatter.id,
      status: record.frontmatter.status,
      scope: record.frontmatter.scope,
      source: record.frontmatter.source,
      tags: record.frontmatter.tags,
      contentHash: record.contentHash,
      possibleDuplicate: Boolean(record.possibleDuplicate),
      createdAt: record.frontmatter.createdAt,
      updatedAt: record.frontmatter.updatedAt,
      path: record.path,
      searchText: `${record.content}\n${record.frontmatter.tags.join(" ")}`,
    };

    this.db
      .prepare(`
        INSERT INTO memories (
          id, status, scope, source, tags, content_hash, possible_duplicate,
          created_at, updated_at, path, search_text
        )
        VALUES (
          @id, @status, @scope, @source, @tags, @contentHash, @possibleDuplicate,
          @createdAt, @updatedAt, @path, @searchText
        )
        ON CONFLICT(id) DO UPDATE SET
          status = excluded.status,
          scope = excluded.scope,
          source = excluded.source,
          tags = excluded.tags,
          content_hash = excluded.content_hash,
          possible_duplicate = excluded.possible_duplicate,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at,
          path = excluded.path,
          search_text = excluded.search_text
      `)
      .run({
        ...row,
        tags: JSON.stringify(row.tags),
        possibleDuplicate: row.possibleDuplicate ? 1 : 0,
      });

    return row;
  }

  list(status?: MemoryStatus): IndexedMemoryRow[] {
    const stmt = status
      ? this.db.prepare("SELECT * FROM memories WHERE status = ? ORDER BY updated_at DESC")
      : this.db.prepare("SELECT * FROM memories ORDER BY updated_at DESC");
    const rows = status ? stmt.all(status) : stmt.all();
    return rows.map((row) => this.mapRow(row as RawMemoryRow));
  }

  search(query: string, status?: MemoryStatus): IndexedMemoryRow[] {
    const trimmedQuery = query.trim().toLowerCase();
    if (!trimmedQuery) {
      return [];
    }

    const normalized = `%${escapeLikePattern(trimmedQuery)}%`;
    const stmt = status
      ? this.db.prepare(
          "SELECT * FROM memories WHERE status = ? AND lower(search_text) LIKE ? ESCAPE '\\' ORDER BY updated_at DESC",
        )
      : this.db.prepare("SELECT * FROM memories WHERE lower(search_text) LIKE ? ESCAPE '\\' ORDER BY updated_at DESC");
    const rows = status ? stmt.all(status, normalized) : stmt.all(normalized);
    return rows.map((row) => this.mapRow(row as RawMemoryRow));
  }

  hasContentHash(contentHash: string): boolean {
    const row = this.db.prepare("SELECT id FROM memories WHERE content_hash = ? LIMIT 1").get(contentHash);
    return Boolean(row);
  }

  clear(): void {
    this.db.prepare("DELETE FROM memories").run();
  }

  close(): void {
    this.db.close();
  }

  private mapRow(row: RawMemoryRow): IndexedMemoryRow {
    return {
      id: row.id,
      status: row.status,
      scope: row.scope,
      source: row.source,
      tags: JSON.parse(row.tags) as string[],
      contentHash: row.content_hash,
      possibleDuplicate: Boolean(row.possible_duplicate),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      path: row.path,
      searchText: row.search_text,
    };
  }
}
