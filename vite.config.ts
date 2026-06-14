import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {
    ignorePatterns: [
      "dist/**",
      "node_modules/**",
      "data/raw/**",
      "data/registry.json",
      "data/registry.min.json",
      "data/registry.ndjson",
      "data/registry.csv",
      "data/sources.json",
      "data/stats.json",
      "schemas/*.json",
      "tests/fixtures/fr-afirev/public-prefixes.json",
      "build/change-summary.md",
    ],
  },
  lint: {
    ignorePatterns: ["dist/**", "node_modules/**"],
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
});
