import { describe, expect, it } from "vitest";
import { createNonIdrrReportPayloads } from "../../src/application/non-idrr-reports.js";
import {
  makeObservationKey,
  type IdentifierObservation,
} from "../../src/domain/identifier-observation.js";
import type { NormalizedRegistryRecord } from "../../src/domain/registry-record.js";
import type { SourceDefinition } from "../../src/domain/source-definition.js";
import { validateObservations } from "../../src/validation/observation-validator.js";

describe("non-IDRR observations", () => {
  it("uses scheme in the stable observation key", () => {
    const ocpiKey = makeObservationKey({
      sourceId: "public-ocpi",
      scheme: "OCPI_PARTY_ID",
      countryCode: "FR",
      partyId: "ABC",
      role: "CPO",
      sourceRecordId: null,
      sourceValue: "FR-ABC",
    });
    const emi3Key = makeObservationKey({
      sourceId: "public-ocpi",
      scheme: "EMI3_OPERATOR_ID",
      countryCode: "FR",
      partyId: "ABC",
      role: "CPO",
      sourceRecordId: null,
      sourceValue: "FR-ABC",
    });

    expect(ocpiKey).not.toBe(emi3Key);
  });

  it("rejects OCPI party identifiers classified as official eMI3 assignments", () => {
    const observation = sampleObservation({
      scheme: "OCPI_PARTY_ID",
      observationType: "OFFICIAL_ASSIGNMENT",
      authorityLevel: "AUTHORITATIVE",
    });

    const issues = validateObservations([observation]);

    expect(issues.some((issue) => issue.code === "OCPI_AS_OFFICIAL_EMI3")).toBe(true);
  });

  it("keeps observed EVSE prefixes unverified", () => {
    const observation = sampleObservation({
      scheme: "EVSE_PREFIX",
      observationType: "INFRASTRUCTURE_OBSERVATION",
      authorityLevel: "SECONDARY",
    });

    const issues = validateObservations([observation]);

    expect(issues.some((issue) => issue.code === "EVSE_PREFIX_AUTHORITY")).toBe(true);
  });

  it("generates deterministic empty reports without changing official source semantics", async () => {
    const reports = await createNonIdrrReportPayloads(
      [sampleSource()],
      [],
      "2026-06-15T00:00:00.000Z",
    );

    expect(reports.additionsReport.additions).toEqual([]);
    expect(reports.conflictsReport.conflicts).toEqual([]);
    expect(reports.overlapReport.overlap).toEqual([]);
    expect(reports.sourceHealthReport.sources).toMatchObject([
      {
        sourceId: "fr-afirev",
        enabled: true,
        authorityLevel: "AUTHORITATIVE",
        observationType: "OFFICIAL_ASSIGNMENT",
        observationCount: 0,
        status: "current",
      },
    ]);
  });

  it("does not classify OCPI party observations as official eMI3 overlap", async () => {
    const observation = sampleObservation({
      scheme: "OCPI_PARTY_ID",
      observationType: "NETWORK_REGISTRATION",
      authorityLevel: "SELF_ASSERTED",
    });

    const reports = await createNonIdrrReportPayloads(
      [sampleSource()],
      [observation],
      "2026-06-15T00:00:00.000Z",
      [sampleOfficialRecord()],
    );

    expect(reports.overlapReport.overlap).toEqual([]);
    expect(reports.additionsReport.additions).toMatchObject([
      {
        category: "NEW_SCHEME_FOR_KNOWN_PARTY",
        observationKey: observation.key,
        scheme: "OCPI_PARTY_ID",
      },
    ]);
    expect(reports.conflictsReport.conflicts).toMatchObject([
      {
        category: "OCPI_VS_EMI3_CONFUSION",
        observationKey: observation.key,
        officialKey: "fr-afirev:FR:ABC:CPO",
      },
    ]);
  });
});

function sampleObservation(
  overrides: Pick<IdentifierObservation, "scheme"> & {
    observationType: IdentifierObservation["source"]["observationType"];
    authorityLevel: IdentifierObservation["source"]["authorityLevel"];
  },
): IdentifierObservation {
  const sourceValue = "FR-ABC";
  return {
    key: makeObservationKey({
      sourceId: "public-ocpi",
      scheme: overrides.scheme,
      countryCode: "FR",
      partyId: "ABC",
      role: "CPO",
      sourceRecordId: null,
      sourceValue,
    }),
    scheme: overrides.scheme,
    countryCode: "FR",
    partyId: "ABC",
    normalizedValue: "FRABC",
    role: "CPO",
    status: "ACTIVE",
    organization: { name: "Example", legalName: null, website: null },
    source: {
      sourceId: "public-ocpi",
      authorityLevel: overrides.authorityLevel,
      observationType: overrides.observationType,
      sourceRecordId: null,
      sourceValue,
      sourceUrl: "https://example.com/ocpi",
      evidenceUrl: null,
      firstSeenAt: "2026-06-15T00:00:00.000Z",
      lastSeenAt: "2026-06-15T00:00:00.000Z",
      retrievedAt: "2026-06-15T00:00:00.000Z",
    },
    confidence: { score: 0.5, reasons: ["test fixture"] },
    metadata: {},
  };
}

function sampleSource(): SourceDefinition {
  return {
    id: "fr-afirev",
    name: "AFIREV",
    authorityName: "AFIREV",
    jurisdictions: ["FR"],
    official: true,
    homepageUrl: "https://afirev.fr/",
    registryUrl: "https://afirev.fr/prefixes/consulter-l-annuaire/",
    connector: "fr-afirev",
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
    safety: { maxDeletionRatio: 0.2, maxChangeRatio: 0.5, maxParseErrorRatio: 0.05 },
  };
}

function sampleOfficialRecord(): NormalizedRegistryRecord {
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
      firstSeenAt: "2026-06-15T00:00:00.000Z",
      lastSeenAt: "2026-06-15T00:00:00.000Z",
      retrievedAt: "2026-06-15T00:00:00.000Z",
    },
    metadata: {},
  };
}
