import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

// shared.js is a classic browser script: run it in a sandbox with the few
// globals it reads at load time and read its functions back.
const source = readFileSync(new URL("../public/shared.js", import.meta.url), "utf8");
const sandbox: Record<string, unknown> = {
  window: { location: { origin: "https://example.test" } },
  localStorage: { getItem: () => null, setItem: () => undefined },
  navigator: { languages: ["en"], language: "en" },
};
runInNewContext(`${source}\nthis.exports = { statusLabel, statusBadge };`, sandbox);
const { statusLabel, statusBadge } = sandbox.exports as {
  statusLabel: (status: string, lang?: string) => string;
  statusBadge: (status: string, lang?: string) => string;
};

describe("shared.js status labels", () => {
  it.each([
    ["REVOKED", "fr", "Révoqué"],
    ["REVOKED", "en", "Revoked"],
    ["ACTIVE", "fr", "Actif"],
  ])("labels %s in %s as %j", (status, lang, expected) => {
    expect(statusLabel(status, lang)).toBe(expected);
  });

  it("gives REVOKED a badge colour rather than the fallback grey", () => {
    expect(statusBadge("REVOKED", "en")).not.toContain("color:#6b7886;");
    expect(statusBadge("REVOKED", "fr")).toContain("Révoqué");
  });
});
