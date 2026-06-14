import { describe, expect, it } from "vitest";
import { diffRecords } from "../../src/application/change-report.js";
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

function sampleRecord(retrievedAt: string): NormalizedRegistryRecord {
  return {
    key: "fr-afirev:FR:ABC:CPO",
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
