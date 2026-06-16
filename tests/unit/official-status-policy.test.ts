import { describe, expect, it } from "vitest";
import { applyOfficialStatusPolicy } from "../../src/application/official-status-policy.js";
import type { NormalizedRegistryRecord } from "../../src/domain/registry-record.js";

describe("official status policy", () => {
  it("marks active non-official records unknown when the country has official records", () => {
    const records = applyOfficialStatusPolicy([
      sampleRecord({ key: "official:IE:BLK:CPO", countryCode: "IE", official: true }),
      sampleRecord({ key: "secondary:IE:BLK:CPO", countryCode: "IE", official: false }),
    ]);

    expect(records.map((record) => record.status)).toEqual(["ACTIVE", "UNKNOWN"]);
    expect(records[1]?.metadata.statusPolicy).toBe(
      "unknown-non-official-country-with-official-idro",
    );
  });

  it("keeps non-official records active when the country has no official records", () => {
    const records = applyOfficialStatusPolicy([
      sampleRecord({ key: "secondary:GB:ABC:CPO", countryCode: "GB", official: false }),
    ]);

    expect(records[0]?.status).toBe("ACTIVE");
  });

  it("does not change already inactive non-official records", () => {
    const records = applyOfficialStatusPolicy([
      sampleRecord({ key: "official:IE:BLK:CPO", countryCode: "IE", official: true }),
      sampleRecord({
        key: "secondary:IE:BLK:CPO",
        countryCode: "IE",
        official: false,
        status: "INACTIVE",
      }),
    ]);

    expect(records[1]?.status).toBe("INACTIVE");
    expect(records[1]?.metadata.statusPolicy).toBeUndefined();
  });
});

function sampleRecord({
  key,
  countryCode,
  official,
  status = "ACTIVE",
}: {
  key: string;
  countryCode: string;
  official: boolean;
  status?: NormalizedRegistryRecord["status"];
}): NormalizedRegistryRecord {
  const partyId = key.split(":")[2] ?? "ABC";
  return {
    key,
    countryCode,
    partyId,
    eMobilityId: `${countryCode}${partyId}`,
    role: "CPO",
    status,
    organization: { name: "Example", legalName: null, website: null },
    source: {
      registryId: key.split(":")[0] ?? "source",
      official,
      sourceRecordId: `${countryCode}${partyId}`,
      sourceUrl: "https://example.com/register",
      sourceValue: `${countryCode}${partyId}`,
      firstSeenAt: "2026-06-16T00:00:00.000Z",
      lastSeenAt: "2026-06-16T00:00:00.000Z",
      retrievedAt: "2026-06-16T00:00:00.000Z",
    },
    metadata: {},
  };
}
