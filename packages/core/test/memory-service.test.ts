import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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

  it("rejects empty capture content", async () => {
    const service = createService();

    await expect(service.capture({ content: "   " })).rejects.toThrow("Memory content is required");
  });
});
