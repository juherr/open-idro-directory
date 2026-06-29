import { describe, expect, it } from "vitest";
import { diffRecords, renderChangeReports } from "../../src/application/change-report.js";
import type { NormalizedRegistryRecord } from "../../src/domain/registry-record.js";

describe("change report diff", () => {
  it("does not treat observation timestamp changes as record updates", () => {
    const previous = sampleRecord("2026-06-14T00:00:00.000Z");
    const current = sampleRecord("2026-06-15T00:00:00.000Z");

    const diff = diffRecords([previous], [current]);

    expect(diff.updated).toHaveLength(0);
    expect(diff.unchanged).toBe(1);
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
