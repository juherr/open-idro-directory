import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { buildImportBundle, writeImportBundle } from "./bundle.js";

describe("Cloudflare import bundle", () => {
  it("builds deterministic active-release rows from generated data", async () => {
    const bundle = await buildImportBundle();
    expect(bundle.release.record_count).toBe(bundle.observations.length);
    expect(bundle.manifest.files["observations.ndjson"]?.rows).toBe(bundle.observations.length);
    expect(bundle.parties.length).toBeGreaterThan(0);
    expect(bundle.observations[0]?.dataset_release_id).toBe(bundle.release.id);
  });

  it("writes D1 remote-compatible import SQL", async () => {
    await writeImportBundle();

    const sql = await readFile("build/cloudflare/import.sql", "utf8");
    expect(sql).not.toMatch(/\bBEGIN\s+TRANSACTION\b/i);
    expect(sql).not.toMatch(/\bSAVEPOINT\b/i);
    expect(sql).not.toMatch(/\bCOMMIT\b/i);
    expect(sql).toContain("INSERT INTO active_dataset");
  });
});
