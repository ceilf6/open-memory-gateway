import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execa } from "execa";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

let root: string;
const cliPath = fileURLToPath(new URL("../src/index.ts", import.meta.url));

beforeAll(async () => {
  await execa("pnpm", ["--filter", "@open-memory-gateway/core", "build"]);
});

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "omg-cli-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

async function runMemory(args: string[]) {
  return execa("pnpm", ["tsx", cliPath, ...args], {
    env: { ...process.env, OPEN_MEMORY_ROOT: root },
  });
}

describe("memory CLI", () => {
  it("captures, lists, approves, and searches memory", async () => {
    const capture = await runMemory(["capture", "CLI captured memory", "--tag", "cli"]);
    expect(capture.stdout).toContain("draft");

    const listDrafts = await runMemory(["list", "--status", "draft"]);
    expect(listDrafts.stdout).toContain("CLI captured memory");

    const id = /mem_[0-9]{8}_[a-z0-9]+/.exec(listDrafts.stdout)?.[0];
    expect(id).toBeTruthy();

    await runMemory(["approve", id as string]);
    const search = await runMemory(["search", "captured", "--status", "active"]);
    expect(search.stdout).toContain(id);
  });

  it("rejects and archives memories", { timeout: 15000 }, async () => {
    await runMemory(["capture", "Memory to reject"]);
    const drafts = await runMemory(["list", "--status", "draft"]);
    const rejectedId = /mem_[0-9]{8}_[a-z0-9]+/.exec(drafts.stdout)?.[0];
    expect(rejectedId).toBeTruthy();

    await runMemory(["reject", rejectedId as string]);
    const rejected = await runMemory(["list", "--status", "rejected"]);
    expect(rejected.stdout).toContain(rejectedId);

    await runMemory(["capture", "Memory to archive"]);
    const archiveDrafts = await runMemory(["search", "archive", "--status", "draft"]);
    const archivedId = /mem_[0-9]{8}_[a-z0-9]+/.exec(archiveDrafts.stdout)?.[0];
    expect(archivedId).toBeTruthy();

    await runMemory(["approve", archivedId as string]);
    await runMemory(["archive", archivedId as string]);
    const archived = await runMemory(["list", "--status", "archived"]);
    expect(archived.stdout).toContain(archivedId);
  });

  it("rebuilds the index", async () => {
    await runMemory(["capture", "CLI rebuild memory"]);
    const result = await runMemory(["index", "rebuild"]);
    expect(result.stdout).toContain("\"indexed\": 1");
  });
});
