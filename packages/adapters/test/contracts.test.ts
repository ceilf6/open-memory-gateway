import { describe, expect, it } from "vitest";
import { defineMemoryCaptureAdapter } from "../src/index";

describe("adapter contract helpers", () => {
  it("keeps adapter metadata and capture behavior intact", async () => {
    const adapter = defineMemoryCaptureAdapter({
      name: "test-adapter",
      async capture(input) {
        return {
          id: `captured:${input.source ?? "manual"}`,
          status: "draft",
        };
      },
    });

    await expect(adapter.capture({ content: "Selected text", source: "feishu" })).resolves.toEqual({
      id: "captured:feishu",
      status: "draft",
    });
    expect(adapter.name).toBe("test-adapter");
  });
});
