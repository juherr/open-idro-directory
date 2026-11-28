import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "packages/**/*.test.ts"],
    exclude: ["tests/integration/**/*.live.test.ts", "packages/api-client/**"],
  },
});
