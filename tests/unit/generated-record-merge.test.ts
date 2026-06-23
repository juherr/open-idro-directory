import { describe, expect, it } from "vitest";
import { mergeGeneratedRecords } from "../../src/application/generated-record-merge.js";
import type { NormalizedRegistryRecord } from "../../src/domain/registry-record.js";
import type { SourceDefinition } from "../../src/domain/source-definition.js";

const vanishedAt = "2026-06-16T06:33:14.830Z";

describe("generated record merge", () => {
  it("restores the Polish EIPA records removed from the official source", () => {
    const previous = [
      sampleRecord({ partyId: "2BB", organizationName: "Campi Verdi Sp. z o.o." }),
      sampleRecord({ partyId: "WSY", organizationName: "MKB Monika Kaczynska" }),
      sampleRecord({ partyId: "Z6H", organizationName: "NZOZ Gemini" }),
    ];

    const records = mergeGeneratedRecords(plEipaSource(), previous, [], vanishedAt);

    expect(
      records.map((record) => [record.key, record.status, record.metadata.inactiveSince]),
    ).toEqual([
      ["pl-eipa:PL:2BB:CPO", "INACTIVE", vanishedAt],
      ["pl-eipa:PL:WSY:CPO", "INACTIVE", vanishedAt],
      ["pl-eipa:PL:Z6H:CPO", "INACTIVE", vanishedAt],
    ]);
  });

  it("keeps missing official records as inactive tombstones", () => {
    const previous = sampleRecord({
      firstSeenAt: "2026-06-15T06:38:44.386Z",
      lastSeenAt: "2026-06-15T06:38:44.386Z",
      retrievedAt: "2026-06-15T06:38:44.386Z",
    });

    const records = mergeGeneratedRecords(plEipaSource(), [previous], [], vanishedAt);

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      key: "pl-eipa:PL:2BB:CPO",
      status: "INACTIVE",
      source: {
        firstSeenAt: "2026-06-15T06:38:44.386Z",
        lastSeenAt: "2026-06-15T06:38:44.386Z",
        retrievedAt: vanishedAt,
      },
      metadata: {
        inactiveSince: vanishedAt,
        inactiveReason: "missing-from-official-source",
      },
    });
  });

  it("keeps the original inactive date across later resyncs", () => {
    const previous = sampleRecord({
      status: "INACTIVE",
      retrievedAt: "2026-06-17T00:00:00.000Z",
      metadata: {
        inactiveSince: vanishedAt,
        inactiveReason: "missing-from-official-source",
      },
    });

    const records = mergeGeneratedRecords(
      plEipaSource(),
      [previous],
      [],
      "2026-06-18T00:00:00.000Z",
    );

    expect(records[0]?.metadata.inactiveSince).toBe(vanishedAt);
    expect(records[0]?.source.retrievedAt).toBe("2026-06-18T00:00:00.000Z");
  });

  it("reactivates records that reappear and removes tombstone metadata", () => {
    const previous = sampleRecord({
      status: "INACTIVE",
      firstSeenAt: "2026-06-15T06:38:44.386Z",
      lastSeenAt: "2026-06-15T06:38:44.386Z",
      retrievedAt: vanishedAt,
      metadata: {
        inactiveSince: vanishedAt,
        inactiveReason: "missing-from-official-source",
      },
    });
    const current = sampleRecord({
      firstSeenAt: "2026-06-19T00:00:00.000Z",
      lastSeenAt: "2026-06-19T00:00:00.000Z",
      retrievedAt: "2026-06-19T00:00:00.000Z",
      metadata: { eipaCity: "Kostrzyn" },
    });

    const records = mergeGeneratedRecords(
      plEipaSource(),
      [previous],
      [current],
      current.source.retrievedAt,
    );

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      status: "ACTIVE",
      source: {
        firstSeenAt: "2026-06-15T06:38:44.386Z",
        lastSeenAt: "2026-06-19T00:00:00.000Z",
      },
      metadata: { eipaCity: "Kostrzyn" },
    });
    expect(records[0]?.metadata).not.toHaveProperty("inactiveSince");
    expect(records[0]?.metadata).not.toHaveProperty("inactiveReason");
  });

  it("preserves current official source status for records that remain present", () => {
    const previous = sampleRecord({ status: "ACTIVE" });
    const current = sampleRecord({ status: "RESERVED" });

    const records = mergeGeneratedRecords(
      plEipaSource(),
      [previous],
      [current],
      current.source.retrievedAt,
    );

    expect(records[0]?.status).toBe("RESERVED");
  });
});

function sampleRecord(
  overrides: Partial<NormalizedRegistryRecord> & {
    firstSeenAt?: string;
    lastSeenAt?: string;
    organizationName?: string;
    partyId?: string;
    retrievedAt?: string;
  } = {},
): NormalizedRegistryRecord {
  const partyId = overrides.partyId ?? "2BB";
  const organizationName = overrides.organizationName ?? "Campi Verdi Sp. z o.o.";

  return {
    key: `pl-eipa:PL:${partyId}:CPO`,
    countryCode: "PL",
    partyId,
    eMobilityId: `PL${partyId}`,
    role: "CPO",
    status: overrides.status ?? "ACTIVE",
    organization: { name: organizationName, legalName: organizationName, website: null },
    source: {
      registryId: "pl-eipa",
      official: true,
      sourceRecordId: `PL${partyId}`,
      sourceUrl: "https://eipa.udt.gov.pl/list/csv",
      sourceValue: `PL-${partyId}`,
      firstSeenAt: overrides.firstSeenAt ?? "2026-06-15T06:38:44.386Z",
      lastSeenAt: overrides.lastSeenAt ?? "2026-06-15T06:38:44.386Z",
      retrievedAt: overrides.retrievedAt ?? "2026-06-15T06:38:44.386Z",
    },
    metadata: overrides.metadata ?? {},
  };
}

function plEipaSource(): SourceDefinition {
  return {
    id: "pl-eipa",
    name: "EIPA",
    authorityName: "Urzad Dozoru Technicznego",
    jurisdictions: ["PL"],
    official: true,
    homepageUrl: "https://eipa.udt.gov.pl/list",
    registryUrl: "https://eipa.udt.gov.pl/list/csv",
    connector: "pl-eipa",
    enabled: true,
    refreshSchedule: "weekly",
    supportedRoles: ["CPO", "EMSP"],
    license: {
      status: "unknown",
      name: null,
      url: null,
      attributionRequired: false,
      redistributionAllowed: null,
      notes: null,
    },
    safety: {
      maxDeletionRatio: 0.3,
      maxDeletionCount: 5,
      maxChangeRatio: 0.8,
      maxParseErrorRatio: 0.1,
      acceptedDeletionKeys: [],
    },
  };
}
