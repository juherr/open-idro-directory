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

  it("allows HTML source pages when they are the expected registry format", async () => {
    const source = await loadSourceDefinition("dk-fstyr");
    const current = [sampleRecord("ABC", "dk-fstyr", "DK")];
    const issues = checkSafetyThresholds(
      source,
      [],
      current,
      0,
      "<html><body><table><tr><td>DK-ABC</td></tr></table></body></html>",
    );

    expect(issues.some((issue) => issue.code === "SOURCE_FALLBACK_PAGE")).toBe(false);
  });

  it("allows public pages with login markup in navigation", async () => {
    const source = await loadSourceDefinition("fi-traficom");
    const current = [sampleRecord("ABC", "fi-traficom", "FI")];
    const issues = checkSafetyThresholds(
      source,
      [],
      current,
      0,
      '<html><body><header id="login-header"></header><table><th>Issued CPO ID</th></table></body></html>',
    );

    expect(issues.some((issue) => issue.code === "SOURCE_FALLBACK_PAGE")).toBe(false);
  });

  it("rejects explicit access-control pages", async () => {
    const source = await loadSourceDefinition("dk-fstyr");
    const current = [sampleRecord("ABC", "dk-fstyr", "DK")];
    const issues = checkSafetyThresholds(
      source,
      [],
      current,
      0,
      "<html><body>Access denied</body></html>",
    );

    expect(issues.some((issue) => issue.code === "SOURCE_FALLBACK_PAGE")).toBe(true);
  });
});

function sampleRecord(
  partyId = "ABC",
  registryId = "fr-afirev",
  countryCode = "FR",
): NormalizedRegistryRecord {
  return {
    key: `${registryId}:${countryCode}:${partyId}:CPO`,
    countryCode,
    partyId,
    eMobilityId: `${countryCode}${partyId}`,
    role: "CPO",
    status: "ACTIVE",
    organization: { name: "Example", legalName: null, website: null },
    source: {
      registryId,
      official: true,
      sourceRecordId: `${countryCode}${partyId}`,
      sourceUrl: "https://afirev.fr/prefixes/consulter-l-annuaire/",
      sourceValue: `${countryCode}${partyId}`,
      firstSeenAt: "2026-06-14T00:00:00.000Z",
      lastSeenAt: "2026-06-14T00:00:00.000Z",
      retrievedAt: "2026-06-14T00:00:00.000Z",
    },
    metadata: {},
  };
}
