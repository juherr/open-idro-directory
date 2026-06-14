import { describe, expect, it } from "vitest";
import { checkSafetyThresholds } from "../../src/validation/safety-thresholds.js";
import { validateRegistry } from "../../src/validation/registry-validator.js";
import { loadSourceDefinition } from "../../src/infrastructure/filesystem/source-loader.js";
import type { NormalizedRegistryRecord } from "../../src/domain/registry-record.js";

describe("validation", () => {
  it("detects duplicate stable keys", async () => {
    const source = await loadSourceDefinition("fr-afirev");
    const record = sampleRecord();
    const issues = validateRegistry([record, record], [source]);

    expect(issues.some((issue) => issue.code === "DUPLICATE_KEY")).toBe(true);
  });

  it("rejects suspicious mass deletion", async () => {
    const source = await loadSourceDefinition("fr-afirev");
    const previous = [sampleRecord("A"), sampleRecord("B"), sampleRecord("C")];
    const current = [sampleRecord("A")];
    const issues = checkSafetyThresholds(source, previous, current, 0, '{"data":[]}');

    expect(issues.some((issue) => issue.code === "MASS_DELETION")).toBe(true);
  });
});

function sampleRecord(partyId = "ABC"): NormalizedRegistryRecord {
  return {
    key: `fr-afirev:FR:${partyId}:CPO`,
    countryCode: "FR",
    partyId,
    eMobilityId: `FR${partyId}`,
    role: "CPO",
    status: "ACTIVE",
    organization: { name: "Example", legalName: null, website: null },
    source: {
      registryId: "fr-afirev",
      official: true,
      sourceRecordId: `FR${partyId}`,
      sourceUrl: "https://afirev.fr/prefixes/consulter-l-annuaire/",
      sourceValue: `FR${partyId}`,
      firstSeenAt: "2026-06-14T00:00:00.000Z",
      lastSeenAt: "2026-06-14T00:00:00.000Z",
      retrievedAt: "2026-06-14T00:00:00.000Z",
    },
    metadata: {},
  };
}
