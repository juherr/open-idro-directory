import { describe, expect, it } from "vitest";
import {
  normalizedRegistryRecordSchema,
  type NormalizedRegistryRecord,
} from "../../src/domain/registry-record.js";
import {
  observationOf,
  observationScope,
  withObservation,
  withPublishedObservations,
} from "../../src/domain/registry-observation.js";
import type { SourceDefinition } from "../../src/domain/source-definition.js";
import { loadSourceDefinition } from "../../src/infrastructure/filesystem/source-loader.js";
import { parseCrossRegisterIdentifier } from "../../src/validation/identifier-scope.js";
import { validateRegistry } from "../../src/validation/registry-validator.js";

describe("observation scope", () => {
  it("calls an identifier of a covered country an assignment", async () => {
    const source = await loadSourceDefinition("pl-eipa");

    expect(observationScope(source, "PL")).toEqual({
      kind: "ASSIGNMENT",
      observingJurisdiction: "PL",
    });
    expect(observationScope(source, "pl").observingJurisdiction).toBe("PL");
  });

  it("calls another country's identifier a listing observed by the register's country", async () => {
    const source = await loadSourceDefinition("pl-eipa");

    expect(observationScope(source, "NL")).toEqual({
      kind: "CROSS_REGISTER_LISTING",
      observingJurisdiction: "PL",
    });
  });

  it("leaves the observing country unknown for a register covering several countries", async () => {
    const source = await loadSourceDefinition("benelux-idro");

    expect(observationScope(source, "FR")).toEqual({
      kind: "CROSS_REGISTER_LISTING",
      observingJurisdiction: null,
    });
  });

  it("prefers the block a record carries over the derived one", async () => {
    const source = await loadSourceDefinition("pl-eipa");
    const declared = record("pl-eipa", "PL", {
      observation: { kind: "CROSS_REGISTER_LISTING", observingJurisdiction: "PL" },
    });

    expect(observationOf(declared, source).kind).toBe("CROSS_REGISTER_LISTING");
    expect(observationOf(record("pl-eipa", "NL"), source)).toEqual({
      kind: "CROSS_REGISTER_LISTING",
      observingJurisdiction: "PL",
    });
  });

  it("fills the block a published record lacks and keeps the one it carries", async () => {
    const source = await loadSourceDefinition("pl-eipa");
    const declared = record("pl-eipa", "PL", {
      observation: { kind: "CROSS_REGISTER_LISTING", observingJurisdiction: "PL" },
    });

    expect(withObservation(record("pl-eipa", "NL"), source).source.observation).toEqual({
      kind: "CROSS_REGISTER_LISTING",
      observingJurisdiction: "PL",
    });
    expect(withObservation(declared, source)).toBe(declared);
  });

  it("leaves the records of a register no source describes as they are", async () => {
    const source = await loadSourceDefinition("pl-eipa");
    const orphan = record("xx-gone", "PL");

    const [filled, kept] = withPublishedObservations([record("pl-eipa", "PL"), orphan], [source]);

    expect(filled?.source.observation).toEqual({
      kind: "ASSIGNMENT",
      observingJurisdiction: "PL",
    });
    expect(kept).toBe(orphan);
  });

  it("keeps records without an observation block valid", () => {
    expect(normalizedRegistryRecordSchema.safeParse(record("pl-eipa", "PL")).success).toBe(true);
    expect(
      normalizedRegistryRecordSchema.safeParse(
        record("pl-eipa", "PL", {
          observation: { kind: "SIGHTING", observingJurisdiction: "PL" },
        } as never),
      ).success,
    ).toBe(false);
  });
});

describe("cross-register identifier", () => {
  it("reads a well-formed identifier of another country", async () => {
    const source = await loadSourceDefinition("pl-eipa");

    expect(parseCrossRegisterIdentifier(source, "NL*TNM")).toEqual({
      countryCode: "NL",
      partyId: "TNM",
      separator: "*",
    });
    expect(parseCrossRegisterIdentifier(source, " de-qwc ")).toEqual({
      countryCode: "DE",
      partyId: "QWC",
      separator: "-",
    });
  });

  it("leaves covered, malformed and unassigned identifiers to the rejection path", async () => {
    const source = await loadSourceDefinition("pl-eipa");

    for (const value of ["PL*ABC", "PLABCD", "37", "ZZ*ABC", "UK*ABC"]) {
      expect(parseCrossRegisterIdentifier(source, value), value).toBeNull();
    }
  });
});

describe("registry jurisdiction check", () => {
  let sources: SourceDefinition[];
  const issuesFor = async (candidate: NormalizedRegistryRecord) => {
    sources ??= [await loadSourceDefinition("pl-eipa")];
    return validateRegistry([candidate], sources).filter(
      (issue) => issue.code === "JURISDICTION_MISMATCH",
    );
  };

  it("accepts a cross-register listing outside the register's jurisdictions", async () => {
    const listing = record("pl-eipa", "NL", {
      official: false,
      observation: { kind: "CROSS_REGISTER_LISTING", observingJurisdiction: "PL" },
    });

    expect(await issuesFor(listing)).toEqual([]);
  });

  it("accepts a non-official record published before the observation block existed", async () => {
    // The committed EV Roam Irish rows carry no block and are not official.
    expect(await issuesFor(record("pl-eipa", "NL", { official: false }))).toEqual([]);
  });

  it("still rejects an official record outside the register's jurisdictions", async () => {
    expect(await issuesFor(record("pl-eipa", "NL", { official: true }))).toHaveLength(1);
    const listedOfficial = record("pl-eipa", "NL", {
      official: true,
      observation: { kind: "CROSS_REGISTER_LISTING", observingJurisdiction: "PL" },
    });
    expect(await issuesFor(listedOfficial)).toHaveLength(1);
  });

  it("rejects an observation block that contradicts the jurisdictions", async () => {
    const foreignAssignment = record("pl-eipa", "NL", {
      official: false,
      observation: { kind: "ASSIGNMENT", observingJurisdiction: "NL" },
    });
    const domesticListing = record("pl-eipa", "PL", {
      official: false,
      observation: { kind: "CROSS_REGISTER_LISTING", observingJurisdiction: "PL" },
    });

    expect(await issuesFor(foreignAssignment)).toHaveLength(1);
    expect(await issuesFor(domesticListing)).toHaveLength(1);
  });
});

function record(
  registryId: string,
  countryCode: string,
  source: Partial<NormalizedRegistryRecord["source"]> = {},
): NormalizedRegistryRecord {
  return {
    key: `${registryId}:${countryCode}:ABC:CPO`,
    countryCode,
    partyId: "ABC",
    eMobilityId: `${countryCode}ABC`,
    role: "CPO",
    status: "ACTIVE",
    organization: { name: "Example", legalName: null, website: null },
    source: {
      registryId,
      official: false,
      sourceRecordId: `${countryCode}ABC`,
      sourceUrl: "https://example.test/",
      sourceValue: `${countryCode}*ABC`,
      firstSeenAt: "2026-06-14T00:00:00.000Z",
      lastSeenAt: "2026-06-14T00:00:00.000Z",
      retrievedAt: "2026-06-14T00:00:00.000Z",
      ...source,
    },
    metadata: {},
  };
}
