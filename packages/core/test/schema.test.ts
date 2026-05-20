import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { MemoryFrontmatterSchema, normalizeTags } from "../src/schema";

describe("MemoryFrontmatterSchema", () => {
  it("accepts a valid active memory", () => {
    const parsed = MemoryFrontmatterSchema.parse({
      id: "mem_20260520_abc123",
      status: "active",
      scope: "personal",
      source: "manual",
      tags: ["preference", "work"],
      createdAt: "2026-05-20T10:00:00+08:00",
      updatedAt: "2026-05-20T10:05:00+08:00",
    });

    expect(parsed.status).toBe("active");
  });

  it("rejects unsupported statuses", () => {
    try {
      MemoryFrontmatterSchema.parse({
        id: "mem_20260520_bad123",
        status: "pending",
        scope: "personal",
        source: "manual",
        tags: [],
        createdAt: "2026-05-20T10:00:00+08:00",
        updatedAt: "2026-05-20T10:00:00+08:00",
      });
    } catch (error) {
      expect(error).toBeInstanceOf(ZodError);
      expect((error as ZodError).issues[0]?.path).toEqual(["status"]);
      return;
    }

    throw new Error("Expected invalid status to be rejected");
  });

  it("normalizes tag casing, spacing, and duplicates", () => {
    expect(normalizeTags([" Work ", "work", "Preference"])).toEqual(["work", "preference"]);
  });
});
