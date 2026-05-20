import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createToolHandlers } from "../src/index";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "omg-mcp-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("MCP tool handlers", () => {
  it("exposes stable tool names", () => {
    const handlers = createToolHandlers({ rootDir: root });
    expect(Object.keys(handlers).sort()).toEqual([
      "approve_memory",
      "capture_memory",
      "list_memories",
      "search_memories",
      "update_memory",
    ]);
    handlers.close();
  });

  it("captures and approves memory through handlers", async () => {
    const handlers = createToolHandlers({ rootDir: root });
    const draft = await handlers.capture_memory({
      content: "Remember MCP integration.",
      source: "mcp-test",
      tags: ["MCP"],
    });

    expect(draft.frontmatter.status).toBe("draft");
    expect(draft.frontmatter.tags).toEqual(["mcp"]);

    const active = await handlers.approve_memory({ id: draft.frontmatter.id });
    expect(active.frontmatter.status).toBe("active");

    const results = await handlers.search_memories({ query: "integration", status: "active" });
    expect(results).toHaveLength(1);
    handlers.close();
  });
});
