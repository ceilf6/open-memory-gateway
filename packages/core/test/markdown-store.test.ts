import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MarkdownMemoryStore } from "../src/markdown-store";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "omg-markdown-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("MarkdownMemoryStore", () => {
  it("writes and reads one draft memory file", async () => {
    const store = new MarkdownMemoryStore({ rootDir: root });
    const record = await store.write({
      frontmatter: {
        id: "mem_20260520_abc123",
        status: "draft",
        scope: "personal",
        source: "manual",
        tags: ["work"],
        createdAt: "2026-05-20T10:00:00+08:00",
        updatedAt: "2026-05-20T10:00:00+08:00",
      },
      content: "Remember that I prefer concise implementation plans.",
    });

    expect(record.path).toContain("memory/inbox/mem_20260520_abc123.md");

    const loaded = await store.read("mem_20260520_abc123");
    expect(loaded.content).toBe("Remember that I prefer concise implementation plans.");
    expect(loaded.frontmatter.status).toBe("draft");
  });

  it("moves active memories into memory/active", async () => {
    const store = new MarkdownMemoryStore({ rootDir: root });
    await store.write({
      frontmatter: {
        id: "mem_20260520_def456",
        status: "active",
        scope: "personal",
        source: "manual",
        tags: [],
        createdAt: "2026-05-20T10:00:00+08:00",
        updatedAt: "2026-05-20T10:00:00+08:00",
      },
      content: "Ship Markdown as the source of truth.",
    });

    const loaded = await store.read("mem_20260520_def456");
    expect(loaded.path).toContain("memory/active/mem_20260520_def456.md");
  });
});
