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
    expect(bundle.sources.every((source) => source.reuse_status.length > 0)).toBe(true);
    expect(bundle.sources).not.toContainEqual(
      expect.objectContaining({ license_status: expect.anything() }),
    );
    expect(bundle.sources).toContainEqual(
      expect.objectContaining({
        id: "fi-traficom",
        reuse_status: "licensed",
        reuse_licence_name: "CC BY 4.0",
        reuse_licence_url:
          "https://traficom.fi/en/transport-system/geoinformationsmaterial/use-and-licences-data",
        reuse_attribution_notice: expect.stringContaining("Traficom"),
        reuse_redistribution_allowed: 1,
      }),
    );
    expect(bundle.sources).toContainEqual(
      expect.objectContaining({
        id: "ie-tii",
        reuse_status: "licensed",
        reuse_licence_name: "CC BY 4.0",
        reuse_licence_url: "https://www.tii.ie/en/compliance/reuse-of-public-sector-information/",
        reuse_attribution_notice:
          "Contains Irish Public Sector Information licensed under a Creative Commons Attribution 4.0 International (CC BY 4.0) licence",
        reuse_redistribution_allowed: 1,
      }),
    );
  });

  it("writes D1 remote-compatible import SQL", async () => {
    await writeImportBundle();

    const sql = await readFile("build/cloudflare/import.sql", "utf8");
    expect(sql).not.toMatch(/\bBEGIN\s+TRANSACTION\b/i);
    expect(sql).not.toMatch(/\bSAVEPOINT\b/i);
    expect(sql).not.toMatch(/\bCOMMIT\b/i);
    expect(
      sql.startsWith(
        [
          "DELETE FROM active_dataset;",
          "DELETE FROM conflicts;",
          "DELETE FROM observations;",
          "DELETE FROM party_roles;",
          "DELETE FROM parties;",
          "DELETE FROM sources;",
          "DELETE FROM dataset_releases;",
        ].join("\n"),
      ),
    ).toBe(true);
    expect(sql).toContain("INSERT INTO active_dataset");
  });
});
