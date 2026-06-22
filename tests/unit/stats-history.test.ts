import { describe, expect, it } from "vitest";
import {
  buildCountryRoleHistoryRows,
  parseCountryRoleHistoryCsv,
  toCountryRoleHistoryCsv,
  upsertCountryRoleHistoryRows,
} from "../../src/application/stats-history.js";
import type { NormalizedRegistryRecord } from "../../src/domain/registry-record.js";

describe("stats history", () => {
  it("counts CPO and EMSP records by country", () => {
    const rows = buildCountryRoleHistoryRows(
      [
        sampleRecord({ countryCode: "FR", role: "CPO" }),
        sampleRecord({ countryCode: "FR", role: "EMSP" }),
        sampleRecord({ countryCode: "FR", role: "EMSP", partyId: "BBB" }),
        sampleRecord({ countryCode: "DE", role: "CPO" }),
        sampleRecord({ countryCode: "DE", role: "NSP" }),
      ],
      { generatedAt: "2026-06-22T12:00:00.000Z", staleSources: [] },
    );

    expect(rows).toEqual([
      {
        date: "2026-06-22",
        countryCode: "DE",
        cpo: 1,
        emsp: 0,
        total: 2,
        generatedAt: "2026-06-22T12:00:00.000Z",
        staleSources: [],
      },
      {
        date: "2026-06-22",
        countryCode: "FR",
        cpo: 1,
        emsp: 2,
        total: 3,
        generatedAt: "2026-06-22T12:00:00.000Z",
        staleSources: [],
      },
    ]);
  });

  it("upserts rows for the same date and country", () => {
    const existing =
      parseCountryRoleHistoryCsv(`date,countryCode,cpo,emsp,total,generatedAt,staleSources
2026-06-22,FR,1,1,2,2026-06-22T09:00:00.000Z,
`);
    const current = buildCountryRoleHistoryRows(
      [sampleRecord({ countryCode: "FR", role: "CPO" })],
      { generatedAt: "2026-06-22T12:00:00.000Z", staleSources: ["fr-afirev"] },
    );

    expect(toCountryRoleHistoryCsv(upsertCountryRoleHistoryRows(existing, current))).toBe(
      `date,countryCode,cpo,emsp,total,generatedAt,staleSources
2026-06-22,FR,1,0,1,2026-06-22T12:00:00.000Z,fr-afirev
`,
    );
  });
});

function sampleRecord(
  overrides: Pick<Partial<NormalizedRegistryRecord>, "countryCode" | "role" | "partyId"> = {},
): NormalizedRegistryRecord {
  const countryCode = overrides.countryCode ?? "FR";
  const partyId = overrides.partyId ?? "AAA";
  const role = overrides.role ?? "CPO";
  return {
    key: `test:${countryCode}:${partyId}:${role}`,
    countryCode,
    partyId,
    eMobilityId: `${countryCode}${partyId}`,
    role,
    status: "ACTIVE",
    organization: { name: "Example", legalName: null, website: null },
    source: {
      registryId: "test",
      official: true,
      sourceRecordId: null,
      sourceUrl: "https://example.com",
      sourceValue: `${countryCode}-${partyId}`,
      firstSeenAt: "2026-06-22T12:00:00.000Z",
      lastSeenAt: "2026-06-22T12:00:00.000Z",
      retrievedAt: "2026-06-22T12:00:00.000Z",
    },
    metadata: {},
  };
}
