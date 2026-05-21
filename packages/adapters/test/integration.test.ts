import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MemoryService } from "@open-memory-gateway/core";
import { defineMemoryCaptureAdapter } from "../src/index";
import type { MemoryCaptureAdapter } from "../src/index";

let root: string;
let service: MemoryService;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "omg-adapter-integration-"));
  service = new MemoryService({
    rootDir: root,
    now: () => new Date("2026-05-20T10:00:00+08:00"),
  });
});

afterEach(async () => {
  service.close();
  await rm(root, { recursive: true, force: true });
});

function createServiceAdapter(): MemoryCaptureAdapter {
  return defineMemoryCaptureAdapter({
    name: "service-adapter",
    async capture(input) {
      const record = await service.capture(input);
      return { id: record.frontmatter.id, status: record.frontmatter.status };
    },
  });
}

describe("adapter integration with MemoryService", () => {
  it("captures a memory through the adapter and persists it", async () => {
    const adapter = createServiceAdapter();

    const result = await adapter.capture({
      content: "Integration test memory",
      source: "slack",
      tags: ["testing"],
    });

    expect(result.id).toMatch(/^mem_\d{8}_[a-z0-9]+$/);
    expect(result.status).toBe("draft");

    // Verify the memory was actually persisted
    const listed = await service.list("draft");
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe(result.id);
  });

  it("propagates errors from MemoryService to the adapter caller", async () => {
    const adapter = createServiceAdapter();

    await expect(adapter.capture({ content: "   " })).rejects.toThrow(
      "Memory content is required",
    );
  });

  it("propagates adapter-internal errors (no MemoryService) to the caller", async () => {
    const failingAdapter = defineMemoryCaptureAdapter({
      name: "failing-adapter",
      async capture() {
        throw new Error("Upstream service unavailable");
      },
    });

    await expect(
      failingAdapter.capture({ content: "will not be saved" }),
    ).rejects.toThrow("Upstream service unavailable");
  });

  it("handles missing source field by defaulting to manual", async () => {
    const adapter = createServiceAdapter();

    const result = await adapter.capture({ content: "No source provided" });

    expect(result.status).toBe("draft");

    const listed = await service.list("draft");
    expect(listed).toHaveLength(1);
    expect(listed[0]?.source).toBe("manual");
  });

  it("rejects empty content through the adapter", async () => {
    const adapter = createServiceAdapter();

    await expect(adapter.capture({ content: "" })).rejects.toThrow(
      "Memory content is required",
    );
  });

  it("handles whitespace-only content as empty", async () => {
    const adapter = createServiceAdapter();

    await expect(adapter.capture({ content: "  \n\t  " })).rejects.toThrow(
      "Memory content is required",
    );
  });
});
