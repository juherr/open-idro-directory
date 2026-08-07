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
      "data/registry-invalid.json",
      "data/sources.json",
      "data/stats.json",
      // Generated like the datasets above. `JSON.stringify` always expands
      // arrays, the formatter collapses the short ones, and neither is worth a
      // formatting pass over an artifact nobody edits by hand.
      "data/reports/**",
      "schemas/*.json",
      "tests/fixtures/fr-afirev/public-prefixes.json",
      // Formatting rewrites the escaped Astro island payload, so the captured
      // page would stop matching what SuisseEnergie actually serves.
      "tests/fixtures/ch-suisseenergie/register.html",
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
