import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MarkdownMemoryStore } from "../src/markdown-store";

let root: string;

const baseFrontmatter = {
  id: "mem_20260520_abc123",
  status: "draft" as const,
  scope: "personal",
  source: "manual",
  tags: ["work"],
  createdAt: "2026-05-20T10:00:00+08:00",
  updatedAt: "2026-05-20T10:00:00+08:00",
};

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
      frontmatter: baseFrontmatter,
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

  it("rewrites a draft as active and removes the old inbox file", async () => {
    const store = new MarkdownMemoryStore({ rootDir: root });
    await store.write({
      frontmatter: {
        ...baseFrontmatter,
        id: "mem_20260520_rewrite123",
      },
      content: "Draft content.",
    });

    await store.write({
      frontmatter: {
        ...baseFrontmatter,
        id: "mem_20260520_rewrite123",
        status: "active",
        updatedAt: "2026-05-20T11:00:00+08:00",
      },
      content: "Active content.",
    });

    const inboxPath = path.join(root, "memory", "inbox", "mem_20260520_rewrite123.md");
    const activePath = path.join(root, "memory", "active", "mem_20260520_rewrite123.md");
    await expect(access(inboxPath)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(access(activePath)).resolves.toBeUndefined();

    const loaded = await store.read("mem_20260520_rewrite123");
    expect(loaded.path).toBe(activePath);
    expect(loaded.content).toBe("Active content.");
    expect(loaded.frontmatter.status).toBe("active");
  });

  it("keeps the old inbox file if an active rewrite cannot replace the target", async () => {
    const store = new MarkdownMemoryStore({ rootDir: root });
    await store.write({
      frontmatter: {
        ...baseFrontmatter,
        id: "mem_20260520_atomic123",
      },
      content: "Draft content.",
    });

    const inboxPath = path.join(root, "memory", "inbox", "mem_20260520_atomic123.md");
    const activePath = path.join(root, "memory", "active", "mem_20260520_atomic123.md");
    await mkdir(activePath, { recursive: true });

    await expect(
      store.write({
        frontmatter: {
          ...baseFrontmatter,
          id: "mem_20260520_atomic123",
          status: "active",
          updatedAt: "2026-05-20T11:00:00+08:00",
        },
        content: "Active content.",
      }),
    ).rejects.toThrow();

    await expect(access(inboxPath)).resolves.toBeUndefined();
    const loaded = await store.read("mem_20260520_atomic123");
    expect(loaded.path).toBe(inboxPath);
    expect(loaded.content).toBe("Draft content.");
    expect(loaded.frontmatter.status).toBe("draft");
  });

  it("rejects malformed memory ids before path lookup", async () => {
    const store = new MarkdownMemoryStore({ rootDir: root });

    await expect(store.read("../mem_20260520_bad123")).rejects.toThrow(
      "Invalid memory id: ../mem_20260520_bad123",
    );
  });

  it("lists the exact active file when a duplicate inbox file has the same id", async () => {
    const store = new MarkdownMemoryStore({ rootDir: root });
    await store.write({
      frontmatter: {
        ...baseFrontmatter,
        id: "mem_20260520_dupe123",
        status: "active",
      },
      content: "Active copy.",
    });

    const inboxPath = path.join(root, "memory", "inbox", "mem_20260520_dupe123.md");
    await mkdir(path.dirname(inboxPath), { recursive: true });
    await writeFile(
      inboxPath,
      [
        "---",
        "id: mem_20260520_dupe123",
        "status: active",
        "scope: personal",
        "source: manual",
        "tags: []",
        'createdAt: "2026-05-20T10:00:00+08:00"',
        'updatedAt: "2026-05-20T10:00:00+08:00"',
        "---",
        "Stale inbox copy.",
        "",
      ].join("\n"),
      "utf8",
    );

    const active = await store.list("active");
    expect(active).toHaveLength(1);
    expect(active[0]?.path).toBe(path.join(root, "memory", "active", "mem_20260520_dupe123.md"));
    expect(active[0]?.content).toBe("Active copy.");
  });

  it("stores rejected files in inbox and archived files in archived", async () => {
    const store = new MarkdownMemoryStore({ rootDir: root });

    const rejected = await store.write({
      frontmatter: {
        ...baseFrontmatter,
        id: "mem_20260520_reject123",
        status: "rejected",
      },
      content: "Rejected content.",
    });
    const archived = await store.write({
      frontmatter: {
        ...baseFrontmatter,
        id: "mem_20260520_archive123",
        status: "archived",
      },
      content: "Archived content.",
    });

    expect(rejected.path).toContain("memory/inbox/mem_20260520_reject123.md");
    expect(archived.path).toContain("memory/archived/mem_20260520_archive123.md");
  });
});
