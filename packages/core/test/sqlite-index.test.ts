import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SQLiteMemoryIndex } from "../src/sqlite-index";

let root: string;
let indexes: SQLiteMemoryIndex[];

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
  indexes = [];
});

afterEach(async () => {
  for (const index of indexes.splice(0)) {
    index.close();
  }
  await rm(root, { recursive: true, force: true });
});

function createIndex(): SQLiteMemoryIndex {
  const index = new SQLiteMemoryIndex({ rootDir: root });
  indexes.push(index);
  return index;
}

describe("SQLiteMemoryIndex", () => {
  it("indexes and searches memory records", () => {
    const index = createIndex();
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
    const index = createIndex();
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
    const index = createIndex();
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
    const index = createIndex();
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
    const index = createIndex();
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

  it("treats percent signs as literal search text", () => {
    const index = createIndex();
    index.upsert({
      frontmatter: {
        ...baseFrontmatter,
        id: "mem_percent_content",
        tags: ["pricing"],
      },
      content: "Discount is 50% for launch.",
      path: "/tmp/percent.md",
      contentHash: "hash-percent",
    });
    index.upsert({
      frontmatter: {
        ...baseFrontmatter,
        id: "mem_percent_tag",
        tags: ["sql%literal"],
      },
      content: "Tag contains the symbol.",
      path: "/tmp/percent-tag.md",
      contentHash: "hash-percent-tag",
    });
    index.upsert({
      frontmatter: {
        ...baseFrontmatter,
        id: "mem_plain",
        tags: ["plain"],
      },
      content: "Plain text without wildcard symbols.",
      path: "/tmp/plain.md",
      contentHash: "hash-plain",
    });

    const ids = index.search("%").map((row) => row.id).sort();
    expect(ids).toEqual(["mem_percent_content", "mem_percent_tag"]);
  });

  it("treats underscores as literal search text", () => {
    const index = createIndex();
    index.upsert({
      frontmatter: {
        ...baseFrontmatter,
        id: "mem_underscore_content",
        tags: ["planning"],
      },
      content: "Use snake_case for this value.",
      path: "/tmp/underscore.md",
      contentHash: "hash-underscore",
    });
    index.upsert({
      frontmatter: {
        ...baseFrontmatter,
        id: "mem_underscore_tag",
        tags: ["needs_review"],
      },
      content: "Tag contains the symbol.",
      path: "/tmp/underscore-tag.md",
      contentHash: "hash-underscore-tag",
    });
    index.upsert({
      frontmatter: {
        ...baseFrontmatter,
        id: "mem_without_underscore",
        tags: ["plain"],
      },
      content: "Plain text without wildcard symbols.",
      path: "/tmp/plain.md",
      contentHash: "hash-plain",
    });

    const ids = index.search("_").map((row) => row.id).sort();
    expect(ids).toEqual(["mem_underscore_content", "mem_underscore_tag"]);
  });

  it("returns no results for whitespace-only search text", () => {
    const index = createIndex();
    index.upsert({
      frontmatter: baseFrontmatter,
      content: "Stored text",
      path: "/tmp/mem.md",
      contentHash: "hash1",
    });

    expect(index.search("   ")).toEqual([]);
  });

  it("filters search results by status", () => {
    const index = createIndex();
    index.upsert({
      frontmatter: {
        ...baseFrontmatter,
        id: "mem_active",
        status: "active",
      },
      content: "Retention policy text",
      path: "/tmp/active.md",
      contentHash: "hash-active",
    });
    index.upsert({
      frontmatter: {
        ...baseFrontmatter,
        id: "mem_archived",
        status: "archived",
      },
      content: "Retention policy text",
      path: "/tmp/archived.md",
      contentHash: "hash-archived",
    });

    const results = index.search("policy", "active");
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe("mem_active");
  });

  it("preserves possibleDuplicate after reading rows back", () => {
    const index = createIndex();
    index.upsert({
      frontmatter: baseFrontmatter,
      content: "Potential duplicate text",
      path: "/tmp/mem.md",
      contentHash: "hash1",
      possibleDuplicate: true,
    });

    expect(index.search("duplicate")[0]?.possibleDuplicate).toBe(true);
  });
});
