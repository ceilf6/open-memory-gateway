import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createMemoryActions } from "../src/memory-actions";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "omg-web-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("web memory actions", () => {
  it("captures, approves, and searches selected text", async () => {
    const actions = createMemoryActions({ rootDir: root });
    const draft = await actions.captureMemory({
      content: "OpenClaw should remember selected Feishu text.",
      source: "feishu-selection",
      tags: ["Feishu", "Agent"],
    });

    expect(draft.frontmatter.status).toBe("draft");
    expect(draft.frontmatter.tags).toEqual(["feishu", "agent"]);

    const approved = await actions.approveMemory(draft.frontmatter.id);
    expect(approved.frontmatter.status).toBe("active");

    const results = await actions.searchMemories({ query: "selected", status: "active" });
    expect(results.map((row) => row.id)).toEqual([draft.frontmatter.id]);
    actions.close();
  });

  it("edits memory text and status from the review surface", async () => {
    const actions = createMemoryActions({ rootDir: root });
    const draft = await actions.captureMemory({ content: "Temporary wording.", source: "manual" });

    const updated = await actions.updateMemory(draft.frontmatter.id, {
      content: "Durable wording for the agent.",
      status: "active",
      tags: ["reviewed"],
    });

    expect(updated.content).toBe("Durable wording for the agent.");
    expect(updated.frontmatter.status).toBe("active");
    expect(updated.frontmatter.tags).toEqual(["reviewed"]);
    actions.close();
  });
});
