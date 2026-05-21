import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { InvalidMemoryTransitionError, MemoryError, MemoryNotFoundError } from "../src/errors";
import { MemoryService } from "../src/memory-service";
import { SQLiteMemoryIndex } from "../src/sqlite-index";

let root: string;
let services: MemoryService[];
let indexes: SQLiteMemoryIndex[];

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "omg-service-"));
  services = [];
  indexes = [];
});

afterEach(async () => {
  for (const service of services.splice(0)) {
    service.close();
  }
  for (const index of indexes.splice(0)) {
    index.close();
  }
  await rm(root, { recursive: true, force: true });
});

function createService(): MemoryService {
  const service = new MemoryService({
    rootDir: root,
    now: () => new Date("2026-05-20T10:00:00+08:00"),
  });
  services.push(service);
  return service;
}

function createIndex(): SQLiteMemoryIndex {
  const index = new SQLiteMemoryIndex({ rootDir: root });
  indexes.push(index);
  return index;
}

describe("MemoryService", () => {
  it("captures draft memory and approves it", async () => {
    const service = createService();
    const draft = await service.capture({ content: "I prefer concise plans.", tags: ["Work"] });

    expect(draft.frontmatter.status).toBe("draft");
    expect(draft.frontmatter.tags).toEqual(["work"]);

    const active = await service.approve(draft.frontmatter.id);
    expect(active.frontmatter.status).toBe("active");
    expect(active.path).toContain("memory/active");
  });

  it("marks duplicate draft memories", async () => {
    const service = createService();
    await service.capture({ content: "Duplicate memory" });
    const second = await service.capture({ content: " Duplicate   memory " });

    expect(second.possibleDuplicate).toBe(true);
  });

  it("keeps duplicate hint after approving duplicate memory", async () => {
    const service = createService();
    await service.capture({ content: "Duplicate approval memory" });
    const second = await service.capture({ content: " Duplicate   approval memory " });

    const approved = await service.approve(second.frontmatter.id);
    const active = await service.list("active");

    expect(approved.possibleDuplicate).toBe(true);
    expect(active[0]?.id).toBe(second.frontmatter.id);
    expect(active[0]?.possibleDuplicate).toBe(true);
  });

  it("searches active memories", async () => {
    const service = createService();
    const draft = await service.capture({ content: "Remember the OpenClaw memory workflow." });
    await service.approve(draft.frontmatter.id);

    const results = await service.search("OpenClaw", "active");
    expect(results).toHaveLength(1);
  });

  it("rejects draft memories and lists them as rejected", async () => {
    const service = createService();
    const draft = await service.capture({ content: "Reject this memory." });

    const rejected = await service.reject(draft.frontmatter.id);
    const results = await service.list("rejected");

    expect(rejected.frontmatter.status).toBe("rejected");
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe(draft.frontmatter.id);
  });

  it("archives active memories and removes them from active listings", async () => {
    const service = createService();
    const draft = await service.capture({ content: "Archive after approval." });
    const active = await service.approve(draft.frontmatter.id);

    const archived = await service.archive(active.frontmatter.id);
    const activeResults = await service.list("active");
    const archivedResults = await service.list("archived");

    expect(archived.frontmatter.status).toBe("archived");
    expect(activeResults).toEqual([]);
    expect(archivedResults).toHaveLength(1);
    expect(archivedResults[0]?.id).toBe(draft.frontmatter.id);
  });

  it("rebuilds the index from markdown source of truth", async () => {
    const service = createService();
    const draft = await service.capture({ content: "Rebuild restores searchable memory.", tags: ["Restore"] });
    await service.approve(draft.frontmatter.id);

    const index = createIndex();
    index.clear();
    expect(await service.list("active")).toEqual([]);
    expect(await service.search("Rebuild", "active")).toEqual([]);

    const rebuilt = await service.rebuildIndex();

    expect(rebuilt).toBe(1);
    expect(await service.list("active")).toHaveLength(1);
    expect(await service.search("Rebuild", "active")).toHaveLength(1);
  });

  it("recomputes duplicate groups when rebuilding the index", async () => {
    const service = createService();
    const first = await service.capture({ content: "Duplicate rebuild memory" });
    const second = await service.capture({ content: " Duplicate   rebuild memory " });

    await service.rebuildIndex();

    const rows = await service.list("draft");
    const duplicateRows = rows.filter((row) => row.id === first.frontmatter.id || row.id === second.frontmatter.id);
    expect(duplicateRows).toHaveLength(2);
    expect(duplicateRows.every((row) => row.possibleDuplicate)).toBe(true);
  });

  it("rejects empty capture content", async () => {
    const service = createService();

    await expect(service.capture({ content: "   " })).rejects.toThrow(MemoryError);
    await expect(service.capture({ content: "   " })).rejects.toThrow("Memory content is required");
  });

  it("rejects empty update content without erasing existing content", async () => {
    const service = createService();
    const draft = await service.capture({ content: "Keep existing content." });

    await expect(service.update(draft.frontmatter.id, { content: "   " })).rejects.toThrow(MemoryError);
    await expect(service.update(draft.frontmatter.id, { content: "   " })).rejects.toThrow(
      "Memory content is required",
    );

    const results = await service.search("Keep existing");
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe(draft.frontmatter.id);
  });

  it("reads markdown records before clearing the index during rebuild", async () => {
    const service = createService();
    await service.capture({ content: "Survive failed rebuild." });
    const inboxDir = path.join(root, "memory", "inbox");
    await mkdir(inboxDir, { recursive: true });
    await writeFile(
      path.join(inboxDir, "malformed.md"),
      `---
id: not-a-memory-id
status: draft
scope: personal
source: manual
tags: []
createdAt: 2026-05-20T10:00:00+08:00
updatedAt: 2026-05-20T10:00:00+08:00
---
Malformed memory.
`,
      "utf8",
    );

    await expect(service.rebuildIndex()).rejects.toThrow();

    const results = await service.search("Survive failed");
    expect(results).toHaveLength(1);
  });

  it("throws MemoryNotFoundError when updating a non-existent memory", async () => {
    const service = createService();

    await expect(service.update("mem_20260520_abc123", { content: "new" })).rejects.toThrow(MemoryNotFoundError);
    await expect(service.update("mem_20260520_abc123", { content: "new" })).rejects.toThrow("Memory not found");
  });

  it("throws InvalidMemoryTransitionError for invalid status transitions", async () => {
    const service = createService();
    const draft = await service.capture({ content: "Test transition." });
    const active = await service.approve(draft.frontmatter.id);

    await expect(service.update(active.frontmatter.id, { status: "draft" })).rejects.toThrow(
      InvalidMemoryTransitionError,
    );
    await expect(service.update(active.frontmatter.id, { status: "rejected" })).rejects.toThrow(
      InvalidMemoryTransitionError,
    );
  });
});
