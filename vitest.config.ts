import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["packages/**/test/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@open-memory-gateway/core": path.resolve(__dirname, "packages/core/src/index.ts"),
    },
  },
});
