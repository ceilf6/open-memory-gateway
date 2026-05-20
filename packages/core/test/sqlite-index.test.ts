import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SQLiteMemoryIndex } from "../src/sqlite-index";

let root: string;

const baseFrontmatter = {
  id: "mem_20260520_abc123",
  status: "active" as const,
  scope: "personal",
  source: "manual",
  tags: ["work"],
  createdAt: "2026-05-20T10:00:00+08:00",
  updatedAt: "2026-05-20T10:00:00+08:00",
};

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "omg-sqlite-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("SQLiteMemoryIndex", () => {
  it("indexes and searches memory records", () => {
    const index = new SQLiteMemoryIndex({ rootDir: root });
    index.upsert({
      frontmatter: baseFrontmatter,
      content: "I prefer concise implementation plans.",
      path: "/tmp/mem.md",
      contentHash: "hash1",
    });

    const results = index.search("concise");
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe("mem_20260520_abc123");
  });

  it("marks possible duplicates by content hash", () => {
    const index = new SQLiteMemoryIndex({ rootDir: root });
    expect(index.hasContentHash("hash1")).toBe(false);
    index.upsert({
      frontmatter: {
        ...baseFrontmatter,
        status: "draft",
        tags: [],
      },
      content: "duplicate text",
      path: "/tmp/mem.md",
      contentHash: "hash1",
    });
    expect(index.hasContentHash("hash1")).toBe(true);
  });

  it("lists draft records and preserves tags after JSON roundtrip", () => {
    const index = new SQLiteMemoryIndex({ rootDir: root });
    index.upsert({
      frontmatter: {
        ...baseFrontmatter,
        id: "mem_20260520_draft123",
        status: "draft",
        tags: ["work", "planning"],
      },
      content: "Draft text",
      path: "/tmp/draft.md",
      contentHash: "hash-draft",
    });
    index.upsert({
      frontmatter: {
        ...baseFrontmatter,
        id: "mem_20260520_active123",
        status: "active",
        tags: ["active"],
      },
      content: "Active text",
      path: "/tmp/active.md",
      contentHash: "hash-active",
    });

    const results = index.list("draft");
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe("mem_20260520_draft123");
    expect(results[0]?.tags).toEqual(["work", "planning"]);
  });

  it("updates existing rows by id instead of duplicating them", () => {
    const index = new SQLiteMemoryIndex({ rootDir: root });
    index.upsert({
      frontmatter: {
        ...baseFrontmatter,
        status: "draft",
      },
      content: "Original text",
      path: "/tmp/original.md",
      contentHash: "hash-original",
    });

    index.upsert({
      frontmatter: {
        ...baseFrontmatter,
        status: "active",
        updatedAt: "2026-05-20T11:00:00+08:00",
      },
      content: "Updated searchable text",
      path: "/tmp/updated.md",
      contentHash: "hash-updated",
    });

    const results = index.list();
    expect(results).toHaveLength(1);
    expect(results[0]?.status).toBe("active");
    expect(results[0]?.contentHash).toBe("hash-updated");
    expect(index.search("original")).toHaveLength(0);
    expect(index.search("updated")).toHaveLength(1);
  });

  it("removes all rows when cleared", () => {
    const index = new SQLiteMemoryIndex({ rootDir: root });
    index.upsert({
      frontmatter: baseFrontmatter,
      content: "Stored text",
      path: "/tmp/mem.md",
      contentHash: "hash1",
    });

    index.clear();

    expect(index.list()).toEqual([]);
    expect(index.hasContentHash("hash1")).toBe(false);
  });
});
