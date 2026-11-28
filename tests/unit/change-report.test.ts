import { describe, expect, it } from "vitest";
import {
  diffRecords,
  renderChangeReports,
  runFindings,
} from "../../src/application/change-report.js";
import type { NormalizedRegistryRecord } from "../../src/domain/registry-record.js";
import { withPublishedObservations } from "../../src/domain/registry-observation.js";
import { loadSourceDefinitions } from "../../src/infrastructure/filesystem/source-loader.js";

describe("change report diff", () => {
  it("does not treat observation timestamp changes as record updates", () => {
    const previous = sampleRecord("2026-06-14T00:00:00.000Z");
    const current = sampleRecord("2026-06-15T00:00:00.000Z");

    const diff = diffRecords([previous], [current]);

    expect(diff.updated).toHaveLength(0);
    expect(diff.unchanged).toBe(1);
  });

  it("does not count the observation block a published record lacks as an update", async () => {
    const sources = await loadSourceDefinitions();
    const run = "2026-06-15T00:00:00.000Z";
    const published = sampleRecord(run);
    const current = sampleRecord(run);
    current.source = {
      ...current.source,
      observation: { kind: "ASSIGNMENT", observingJurisdiction: "FR" },
    };

    const diff = diffRecords(
      withPublishedObservations([published], sources),
      withPublishedObservations([current], sources),
    );

    expect(diff.updated).toHaveLength(0);
    expect(diff.unchanged).toBe(1);
  });

  it("still counts a switch of observation kind as an update", async () => {
    const sources = await loadSourceDefinitions();
    const run = "2026-06-15T00:00:00.000Z";
    const published = sampleRecord(run);
    published.source = {
      ...published.source,
      observation: { kind: "CROSS_REGISTER_LISTING", observingJurisdiction: "FR" },
    };
    const current = sampleRecord(run);

    const diff = diffRecords(
      withPublishedObservations([published], sources),
      withPublishedObservations([current], sources),
    );

    expect(diff.updated.map((record) => record.key)).toEqual(["fr-afirev:FR:ABC:CPO"]);
  });
});

describe("change report findings", () => {
  it("takes the listings from the published records and the unreadable values from the history", async () => {
    const sources = await loadSourceDefinitions();
    const run = "2026-06-15T00:00:00.000Z";
    const listing: NormalizedRegistryRecord = {
      ...sampleRecord(run, "se-energimyndigheten:DK:MON:CPO"),
      countryCode: "DK",
      partyId: "MON",
      eMobilityId: "DKMON",
    };
    listing.source = {
      ...listing.source,
      registryId: "se-energimyndigheten",
      official: false,
      sourceValue: "DK*MON",
      observation: { kind: "CROSS_REGISTER_LISTING", observingJurisdiction: "SE" },
    };
    const unreadable = {
      registryId: "pl-eipa",
      code: "EIPA_MALFORMED_IDENTIFIER",
      sourceValue: "37",
      message: "Unexpected EIPA identifier syntax: 37",
      firstDetectedAt: run,
      lastDetectedAt: run,
      supersededBy: null,
    };
    const legacy = {
      ...unreadable,
      code: "EIPA_OUT_OF_JURISDICTION_IDENTIFIER",
      sourceValue: "NL*TNM",
      countryCode: "NL",
    };

    const findings = runFindings(
      [sampleRecord(run), listing],
      { generatedAt: run, records: [], rows: [unreadable], outOfJurisdiction: [legacy] },
      sources,
    );

    expect(findings.rows.map((row) => row.sourceValue)).toEqual(["37"]);
    // An old history entry is not a listing the run published.
    expect(findings.crossRegisterListings).toEqual([
      expect.objectContaining({
        registryId: "se-energimyndigheten",
        sourceValue: "DK*MON",
        countryCode: "DK",
      }),
    ]);
  });
});

describe("change report rendering", () => {
  it("keeps the record-level tables in the full report but omits them from the PR body", () => {
    const { full, prBody } = renderChangeReports([
      {
        sourceId: "fr-afirev",
        diff: {
          previous: 0,
          current: 1,
          added: [sampleRecord("2026-06-15T00:00:00.000Z")],
          updated: [],
          removed: [],
          unchanged: 0,
        },
      },
    ]);

    expect(full).toContain("<details>");
    expect(full).toContain("| Added | fr-afirev:FR:ABC:CPO | n/a |");
    expect(prBody).toContain("## fr-afirev");
    expect(prBody).toContain("- Added: 1");
    expect(prBody).not.toContain("<details>");
    expect(prBody).not.toContain("fr-afirev:FR:ABC:CPO");
  });

  it("counts what each source published that could not be used, and its listings", () => {
    const { full, prBody } = renderChangeReports([
      {
        sourceId: "pl-eipa",
        diff: { previous: 1, current: 1, added: [], updated: [], removed: [], unchanged: 1 },
        findings: {
          unreadable: [{ sourceValue: "37" }],
          crossRegisterListings: [
            { sourceValue: "NL*TNM", countryCode: "NL" },
            { sourceValue: "DE-QWC", countryCode: "DE" },
          ],
        },
      },
    ]);

    for (const report of [full, prBody]) {
      expect(report).toContain("- Unreadable values: 1");
      expect(report).toContain("- Cross-register listings: 2");
      // A listing is published, not refused: nothing calls it invalid.
      expect(report).not.toMatch(/invalid|out-of-jurisdiction/i);
    }
    // The values themselves belong to the full report, next to the record-level
    // changes; the PR body stays a summary.
    expect(full).toContain("| Cross-register listing | NL*TNM | NL |");
    expect(full).toContain("| Unreadable | 37 | n/a |");
    expect(prBody).not.toContain("NL*TNM");
  });

  it("reports a source with nothing to flag as zero", () => {
    const { full } = renderChangeReports([
      {
        sourceId: "fr-afirev",
        diff: { previous: 1, current: 1, added: [], updated: [], removed: [], unchanged: 1 },
      },
    ]);

    expect(full).toContain("- Unreadable values: 0");
    expect(full).toContain("- Cross-register listings: 0");
    expect(full).not.toContain("Warnings:");
  });

  it("reports failed sources first, in both the full report and the PR body", () => {
    const { full, prBody } = renderChangeReports(
      [
        {
          sourceId: "fr-afirev",
          diff: { previous: 1, current: 1, added: [], updated: [], removed: [], unchanged: 1 },
        },
      ],
      [{ sourceId: "ch-suisseenergie", error: "HTTP 404 while fetching https://example.test/" }],
    );

    for (const report of [full, prBody]) {
      expect(report).toContain("## Failed sources");
      expect(report).toContain(
        "| ch-suisseenergie | HTTP 404 while fetching https://example.test/ |",
      );
      expect(report.indexOf("## Failed sources")).toBeLessThan(report.indexOf("## fr-afirev"));
    }
  });

  it("omits the failure section when every source answered", () => {
    const { full, prBody } = renderChangeReports([
      {
        sourceId: "fr-afirev",
        diff: { previous: 1, current: 1, added: [], updated: [], removed: [], unchanged: 1 },
      },
    ]);

    expect(full).not.toContain("Failed sources");
    expect(prBody).not.toContain("Failed sources");
  });

  it("caps the PR body well under GitHub's 65,536-character body limit", () => {
    const added = Array.from({ length: 5000 }, (_, index) =>
      sampleRecord("2026-06-15T00:00:00.000Z", `fr-afirev:FR:${index}:CPO`),
    );
    const { full, prBody } = renderChangeReports([
      {
        sourceId: "fr-afirev",
        diff: { previous: 0, current: added.length, added, updated: [], removed: [], unchanged: 0 },
      },
    ]);

    // The full report is allowed to be large; the PR body must stay within the cap.
    expect(full.length).toBeGreaterThan(65_536);
    expect(prBody.length).toBeLessThanOrEqual(65_536);
  });
});

function sampleRecord(retrievedAt: string, key = "fr-afirev:FR:ABC:CPO"): NormalizedRegistryRecord {
  return {
    key,
    countryCode: "FR",
    partyId: "ABC",
    eMobilityId: "FRABC",
    role: "CPO",
    status: "ACTIVE",
    organization: { name: "Example", legalName: null, website: null },
    source: {
      registryId: "fr-afirev",
      official: true,
      sourceRecordId: "FRABC",
      sourceUrl: "https://afirev.fr/prefixes/consulter-l-annuaire/",
      sourceValue: "FRABC",
      firstSeenAt: retrievedAt,
      lastSeenAt: retrievedAt,
      retrievedAt,
    },
    metadata: {},
  };
}
