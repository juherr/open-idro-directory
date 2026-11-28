import { describe, expect, it } from "vitest";
import {
  classifyIdentifierProvenance,
  effectiveHealthState,
  identifierRoleKey,
  isInLatestRetrieval,
  isIssuingAssignment,
  issuingProvenanceSchema,
  withIssuingProvenance,
  type IssuingProvenance,
  type SourceHealthState,
} from "../../src/domain/identifier-provenance.js";
import {
  normalizedRegistryRecordSchema,
  type NormalizedRegistryRecord,
  type RegistryRole,
} from "../../src/domain/registry-record.js";
import type { SourceDefinition } from "../../src/domain/source-definition.js";

const RETRIEVED_AT = "2026-06-14T00:00:00.000Z";
const EARLIER = "2026-05-01T00:00:00.000Z";

const plEipa = source("pl-eipa", { jurisdictions: ["PL"] });
const benelux = source("benelux-idro", { jurisdictions: ["BE", "NL", "LU"] });
const dkFstyr = source("dk-fstyr", { jurisdictions: ["DK"] });
const seEnergimyndigheten = source("se-energimyndigheten", { jurisdictions: ["SE"] });
const cyDisabled = source("cy-like", { jurisdictions: ["CY"], enabled: false });
const atLadestellen = source("at-ladestellen", { jurisdictions: ["AT"], roles: ["CPO"] });
const evroam = source("evroam", { jurisdictions: ["GB", "IE"], registryJurisdictions: ["GB"] });
const frSecondary = source("fr-secondary", { jurisdictions: ["FR"], level: "SECONDARY" });
const deFirst = source("de-first", { jurisdictions: ["DE"] });
const deSecond = source("de-second", { jurisdictions: ["DE"] });

const allSources = [
  plEipa,
  benelux,
  dkFstyr,
  seEnergimyndigheten,
  cyDisabled,
  atLadestellen,
  evroam,
  frSecondary,
  deFirst,
  deSecond,
];

const allCurrent: Record<string, SourceHealthState> = Object.fromEntries(
  allSources.map((entry) => [entry.id, "CURRENT" as const]),
);

interface Row {
  name: string;
  records: NormalizedRegistryRecord[];
  health?: Record<string, SourceHealthState>;
  sources?: SourceDefinition[];
  key: string;
  expected: IssuingProvenance;
}

const rows: Row[] = [
  {
    name: "an identifier assigned by its issuing register is confirmed",
    records: [record("pl-eipa", "PL", "XYZ")],
    key: "PL:XYZ:CPO",
    expected: { country: "PL", confirmation: "CONFIRMED", confirmedBy: ["pl-eipa"] },
  },
  {
    name: "a cross-register listing alone leaves a current issuer's answer NOT_FOUND",
    records: [record("pl-eipa", "NL", "TNM")],
    key: "NL:TNM:CPO",
    expected: { country: "NL", confirmation: "NOT_FOUND", confirmedBy: [] },
  },
  {
    name: "the issuing register confirms an identifier another register also lists",
    records: [record("pl-eipa", "NL", "TNM"), record("benelux-idro", "NL", "TNM")],
    key: "NL:TNM:CPO",
    expected: { country: "NL", confirmation: "CONFIRMED", confirmedBy: ["benelux-idro"] },
  },
  {
    name: "a Swedish listing of a Danish identifier is NOT_FOUND when dk-fstyr is current",
    records: [record("se-energimyndigheten", "DK", "MON")],
    key: "DK:MON:CPO",
    expected: { country: "DK", confirmation: "NOT_FOUND", confirmedBy: [] },
  },
  {
    name: "a Polish identifier seen elsewhere but absent from pl-eipa is NOT_FOUND",
    records: [record("benelux-idro", "PL", "ABS")],
    key: "PL:ABS:CPO",
    expected: { country: "PL", confirmation: "NOT_FOUND", confirmedBy: [] },
  },
  {
    name: "the same identifier is SOURCE_STALE when pl-eipa is stale",
    records: [record("benelux-idro", "PL", "ABS")],
    health: { ...allCurrent, "pl-eipa": "STALE" },
    key: "PL:ABS:CPO",
    expected: { country: "PL", confirmation: "SOURCE_STALE", confirmedBy: [] },
  },
  {
    name: "the same identifier is SOURCE_UNAVAILABLE when pl-eipa failed",
    records: [record("benelux-idro", "PL", "ABS")],
    health: { ...allCurrent, "pl-eipa": "UNAVAILABLE" },
    key: "PL:ABS:CPO",
    expected: { country: "PL", confirmation: "SOURCE_UNAVAILABLE", confirmedBy: [] },
  },
  {
    name: "a disabled issuing register is SOURCE_UNAVAILABLE",
    records: [record("benelux-idro", "CY", "ABC")],
    key: "CY:ABC:CPO",
    expected: { country: "CY", confirmation: "SOURCE_UNAVAILABLE", confirmedBy: [] },
  },
  {
    name: "an issuing register without known health is SOURCE_UNAVAILABLE",
    records: [record("benelux-idro", "PL", "ABS")],
    health: withoutHealth("pl-eipa"),
    key: "PL:ABS:CPO",
    expected: { country: "PL", confirmation: "SOURCE_UNAVAILABLE", confirmedBy: [] },
  },
  {
    name: "a tombstone in a current issuing register is NOT_FOUND",
    records: [record("pl-eipa", "PL", "OLD", "CPO", { tombstone: true })],
    key: "PL:OLD:CPO",
    expected: { country: "PL", confirmation: "NOT_FOUND", confirmedBy: [] },
  },
  {
    name: "a tombstone in a stale issuing register is SOURCE_STALE",
    records: [record("pl-eipa", "PL", "OLD", "CPO", { tombstone: true })],
    health: { ...allCurrent, "pl-eipa": "STALE" },
    key: "PL:OLD:CPO",
    expected: { country: "PL", confirmation: "SOURCE_STALE", confirmedBy: [] },
  },
  {
    name: "a stale issuing register that still lists the identifier confirms it",
    records: [record("pl-eipa", "PL", "XYZ")],
    health: { ...allCurrent, "pl-eipa": "STALE" },
    key: "PL:XYZ:CPO",
    expected: { country: "PL", confirmation: "CONFIRMED", confirmedBy: ["pl-eipa"] },
  },
  {
    name: "an unavailable issuing register that still lists the identifier confirms it",
    records: [record("pl-eipa", "PL", "XYZ")],
    health: { ...allCurrent, "pl-eipa": "UNAVAILABLE" },
    key: "PL:XYZ:CPO",
    expected: { country: "PL", confirmation: "CONFIRMED", confirmedBy: ["pl-eipa"] },
  },
  {
    name: "an upstream status other than ACTIVE still confirms a listed identifier",
    records: [record("pl-eipa", "PL", "REV", "CPO", { status: "REVOKED" })],
    key: "PL:REV:CPO",
    expected: { country: "PL", confirmation: "CONFIRMED", confirmedBy: ["pl-eipa"] },
  },
  {
    name: "a country no authoritative source covers has NO_ISSUING_SOURCE",
    records: [record("pl-eipa", "IT", "ABC")],
    key: "IT:ABC:CPO",
    expected: { country: "IT", confirmation: "NO_ISSUING_SOURCE", confirmedBy: [] },
  },
  {
    name: "an EMSP identifier of a CPO-only register is UNSUPPORTED_ROLE",
    records: [record("pl-eipa", "AT", "ABC", "EMSP")],
    key: "AT:ABC:EMSP",
    expected: { country: "AT", confirmation: "UNSUPPORTED_ROLE", confirmedBy: [] },
  },
  {
    name: "an EMSP record a CPO-only register publishes itself confirms nothing",
    records: [record("at-ladestellen", "AT", "ABC", "EMSP")],
    key: "AT:ABC:EMSP",
    expected: { country: "AT", confirmation: "UNSUPPORTED_ROLE", confirmedBy: [] },
  },
  {
    name: "the CPO identifier of a CPO-only register is classified normally",
    records: [record("at-ladestellen", "AT", "ABC", "CPO")],
    key: "AT:ABC:CPO",
    expected: { country: "AT", confirmation: "CONFIRMED", confirmedBy: ["at-ladestellen"] },
  },
  {
    name: "a register narrowed to GB does not cover its authority's IE",
    records: [record("evroam", "IE", "ABC")],
    key: "IE:ABC:CPO",
    expected: { country: "IE", confirmation: "NO_ISSUING_SOURCE", confirmedBy: [] },
  },
  {
    name: "a register narrowed to GB confirms GB identifiers",
    records: [record("evroam", "GB", "ABC")],
    key: "GB:ABC:CPO",
    expected: { country: "GB", confirmation: "CONFIRMED", confirmedBy: ["evroam"] },
  },
  {
    name: "an unavailable issuer outranks a stale one",
    records: [record("pl-eipa", "DE", "ABC")],
    health: { ...allCurrent, "de-first": "STALE", "de-second": "UNAVAILABLE" },
    key: "DE:ABC:CPO",
    expected: { country: "DE", confirmation: "SOURCE_UNAVAILABLE", confirmedBy: [] },
  },
  {
    name: "one stale issuer among current ones makes the answer SOURCE_STALE",
    records: [record("pl-eipa", "DE", "ABC")],
    health: { ...allCurrent, "de-second": "STALE" },
    key: "DE:ABC:CPO",
    expected: { country: "DE", confirmation: "SOURCE_STALE", confirmedBy: [] },
  },
  {
    name: "one confirming issuer wins over another unavailable one",
    records: [record("de-first", "DE", "ABC")],
    health: { ...allCurrent, "de-second": "UNAVAILABLE" },
    key: "DE:ABC:CPO",
    expected: { country: "DE", confirmation: "CONFIRMED", confirmedBy: ["de-first"] },
  },
  {
    name: "every confirming issuer is listed, sorted and once",
    records: [
      record("de-second", "DE", "ABC"),
      record("de-first", "DE", "ABC"),
      record("de-first", "DE", "ABC", "CPO", { sourceValue: "DEABC" }),
    ],
    key: "DE:ABC:CPO",
    expected: {
      country: "DE",
      confirmation: "CONFIRMED",
      confirmedBy: ["de-first", "de-second"],
    },
  },
  {
    name: "a non-authoritative source covering the country does not confirm",
    records: [record("fr-secondary", "FR", "ABC")],
    key: "FR:ABC:CPO",
    expected: { country: "FR", confirmation: "NO_ISSUING_SOURCE", confirmedBy: [] },
  },
  {
    name: "a record of a register no source describes never confirms",
    records: [record("xx-gone", "PL", "XYZ")],
    key: "PL:XYZ:CPO",
    expected: { country: "PL", confirmation: "NOT_FOUND", confirmedBy: [] },
  },
  {
    name: "a record carrying a listing block does not confirm even in a covering register",
    records: [
      record("pl-eipa", "PL", "XYZ", "CPO", {
        observation: { kind: "CROSS_REGISTER_LISTING", observingJurisdiction: "PL" },
      }),
    ],
    key: "PL:XYZ:CPO",
    expected: { country: "PL", confirmation: "NOT_FOUND", confirmedBy: [] },
  },
];

describe("issuing-register classification", () => {
  it.each(rows)("$name", ({ records, health, sources, key, expected }) => {
    const classification = classifyIdentifierProvenance(
      records,
      sources ?? allSources,
      health ?? allCurrent,
    );

    expect(classification.get(key)).toEqual(expected);
    expect(issuingProvenanceSchema.parse(expected)).toEqual(expected);
  });

  it("counts disabled sources when looking for an issuing register", () => {
    const classification = classifyIdentifierProvenance(
      [record("cy-like", "CY", "ABC")],
      allSources,
      allCurrent,
    );

    expect(classification.get("CY:ABC:CPO")).toEqual({
      country: "CY",
      confirmation: "CONFIRMED",
      confirmedBy: ["cy-like"],
    });
  });

  it("keeps one entry per identifier and role present in the records", () => {
    const classification = classifyIdentifierProvenance(
      [
        record("pl-eipa", "PL", "XYZ", "CPO"),
        record("pl-eipa", "PL", "XYZ", "EMSP", { tombstone: true }),
        record("benelux-idro", "PL", "XYZ", "CPO"),
      ],
      allSources,
      allCurrent,
    );

    expect([...classification.keys()].sort()).toEqual(["PL:XYZ:CPO", "PL:XYZ:EMSP"]);
    expect(classification.get("PL:XYZ:CPO")?.confirmation).toBe("CONFIRMED");
    expect(classification.get("PL:XYZ:EMSP")?.confirmation).toBe("NOT_FOUND");
  });

  it("builds the key from country, party ID and role", () => {
    expect(identifierRoleKey(record("pl-eipa", "PL", "XYZ", "EMSP"))).toBe("PL:XYZ:EMSP");
  });

  it("does not depend on the order of records or sources", () => {
    const records = [
      record("pl-eipa", "NL", "TNM"),
      record("benelux-idro", "NL", "TNM"),
      record("de-second", "DE", "ABC"),
      record("de-first", "DE", "ABC"),
      record("pl-eipa", "PL", "OLD", "CPO", { tombstone: true }),
    ];
    const sources = [plEipa, benelux, deFirst, deSecond, dkFstyr];
    const health = { ...allCurrent, "de-second": "STALE" as const };
    const reference = sortedEntries(classifyIdentifierProvenance(records, sources, health));

    expect(reference).toHaveLength(3);
    for (const recordOrder of permutations(records)) {
      expect(sortedEntries(classifyIdentifierProvenance(recordOrder, sources, health))).toEqual(
        reference,
      );
    }
    for (const sourceOrder of permutations(sources)) {
      expect(sortedEntries(classifyIdentifierProvenance(records, sourceOrder, health))).toEqual(
        reference,
      );
    }
  });
});

describe("issuing provenance on records", () => {
  it("sets the same block on every record of an identifier and role", () => {
    const records = [record("pl-eipa", "NL", "TNM"), record("benelux-idro", "NL", "TNM")];
    const classification = classifyIdentifierProvenance(records, allSources, allCurrent);

    const enriched = withIssuingProvenance(records, classification);

    expect(enriched.map((entry) => entry.issuing)).toEqual([
      { country: "NL", confirmation: "CONFIRMED", confirmedBy: ["benelux-idro"] },
      { country: "NL", confirmation: "CONFIRMED", confirmedBy: ["benelux-idro"] },
    ]);
  });

  it("replaces a block carried over from an earlier build", () => {
    const stale = {
      ...record("pl-eipa", "PL", "OLD", "CPO", { tombstone: true }),
      issuing: { country: "PL", confirmation: "CONFIRMED", confirmedBy: ["pl-eipa"] },
    } satisfies NormalizedRegistryRecord;
    const classification = classifyIdentifierProvenance([stale], allSources, allCurrent);

    const [enriched] = withIssuingProvenance([stale], classification);

    expect(enriched?.issuing).toEqual({
      country: "PL",
      confirmation: "NOT_FOUND",
      confirmedBy: [],
    });
  });

  it("parses records with and without the block and rejects an unknown confirmation", () => {
    const plain = record("pl-eipa", "PL", "XYZ");
    const classified = {
      ...plain,
      issuing: { country: "PL", confirmation: "CONFIRMED", confirmedBy: ["pl-eipa"] },
    };

    expect(normalizedRegistryRecordSchema.safeParse(plain).success).toBe(true);
    expect(normalizedRegistryRecordSchema.safeParse(classified).success).toBe(true);
    expect(
      normalizedRegistryRecordSchema.safeParse({
        ...plain,
        issuing: { ...classified.issuing, confirmation: "PROBABLY" },
      }).success,
    ).toBe(false);
  });
});

describe("issuing predicates", () => {
  const plCovering = [plEipa];

  it("counts an assignment of an issuing register, tombstone included", () => {
    expect(isIssuingAssignment(record("pl-eipa", "PL", "XYZ"), plEipa, plCovering)).toBe(true);
    expect(
      isIssuingAssignment(record("pl-eipa", "PL", "XYZ", "CPO", { tombstone: true }), plEipa, [
        plEipa,
      ]),
    ).toBe(true);
  });

  it("does not count a source outside the country, a role it does not publish, or a listing", () => {
    expect(isIssuingAssignment(record("benelux-idro", "PL", "XYZ"), benelux, plCovering)).toBe(
      false,
    );
    expect(
      isIssuingAssignment(record("at-ladestellen", "AT", "XYZ", "EMSP"), atLadestellen, [
        atLadestellen,
      ]),
    ).toBe(false);
    const listing = record("pl-eipa", "PL", "XYZ", "CPO", {
      observation: { kind: "CROSS_REGISTER_LISTING", observingJurisdiction: "PL" },
    });
    expect(isIssuingAssignment(listing, plEipa, plCovering)).toBe(false);
  });

  it("reads presence from the latest retrieval", () => {
    expect(isInLatestRetrieval(record("pl-eipa", "PL", "XYZ"))).toBe(true);
    expect(isInLatestRetrieval(record("pl-eipa", "PL", "XYZ", "CPO", { tombstone: true }))).toBe(
      false,
    );
  });

  it("counts an unknown, disabled or unreported source as UNAVAILABLE", () => {
    expect(effectiveHealthState(plEipa, "STALE")).toBe("STALE");
    expect(effectiveHealthState(plEipa, "CURRENT")).toBe("CURRENT");
    expect(effectiveHealthState(undefined, "CURRENT")).toBe("UNAVAILABLE");
    expect(effectiveHealthState(cyDisabled, "CURRENT")).toBe("UNAVAILABLE");
    expect(effectiveHealthState(plEipa, undefined)).toBe("UNAVAILABLE");
  });
});

function sortedEntries(classification: Map<string, IssuingProvenance>) {
  return [...classification.entries()].sort(([left], [right]) => (left < right ? -1 : 1));
}

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  return items.flatMap((item, index) =>
    permutations([...items.slice(0, index), ...items.slice(index + 1)]).map((rest) => [
      item,
      ...rest,
    ]),
  );
}

function withoutHealth(sourceId: string) {
  return Object.fromEntries(Object.entries(allCurrent).filter(([id]) => id !== sourceId));
}

function source(
  id: string,
  options: {
    jurisdictions: string[];
    registryJurisdictions?: string[];
    roles?: RegistryRole[];
    level?: SourceDefinition["authority"]["level"];
    enabled?: boolean;
  },
): SourceDefinition {
  return {
    id,
    name: id,
    authority: {
      id: `${id}-authority`,
      name: id,
      level: options.level ?? "AUTHORITATIVE",
      jurisdictions: options.jurisdictions,
      homepageUrl: "https://example.test/",
    },
    registry: {
      url: "https://example.test/registry",
      observationType: "OFFICIAL_ASSIGNMENT",
      supportedRoles: options.roles ?? ["CPO", "EMSP"],
      ...(options.registryJurisdictions ? { jurisdictions: options.registryJurisdictions } : {}),
    },
    reuse: {
      status: "unspecified",
      legalBasis: null,
      licence: null,
      attributionNotice: null,
      redistributionAllowed: null,
      notes: null,
    },
    publication: {
      connector: id,
      machineReadableUrl: null,
      refreshSchedule: "weekly",
      enabled: options.enabled ?? true,
      verifiedAt: null,
      safety: {
        maxDeletionRatio: 0.3,
        maxDeletionCount: 5,
        maxChangeRatio: 0.8,
        maxParseErrorRatio: 0.1,
        acceptedDeletionKeys: [],
      },
    },
  };
}

function record(
  registryId: string,
  countryCode: string,
  partyId: string,
  role: RegistryRole = "CPO",
  options: {
    tombstone?: boolean;
    status?: NormalizedRegistryRecord["status"];
    sourceValue?: string;
    observation?: NormalizedRegistryRecord["source"]["observation"];
  } = {},
): NormalizedRegistryRecord {
  return {
    key: `${registryId}:${countryCode}:${partyId}:${role}`,
    countryCode,
    partyId,
    eMobilityId: `${countryCode}${partyId}`,
    role,
    status: options.tombstone ? "INACTIVE" : (options.status ?? "ACTIVE"),
    organization: { name: "Example", legalName: null, website: null },
    source: {
      registryId,
      official: false,
      sourceRecordId: `${countryCode}${partyId}`,
      sourceUrl: "https://example.test/",
      sourceValue: options.sourceValue ?? `${countryCode}*${partyId}`,
      firstSeenAt: EARLIER,
      lastSeenAt: options.tombstone ? EARLIER : RETRIEVED_AT,
      retrievedAt: RETRIEVED_AT,
      ...(options.observation ? { observation: options.observation } : {}),
    },
    metadata: options.tombstone ? { inactiveReason: "missing-from-official-source" } : {},
  };
}
