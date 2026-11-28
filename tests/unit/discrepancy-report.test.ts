import { describe, expect, it } from "vitest";
import { z } from "zod";
import { discrepanciesSchema } from "../../src/application/discrepancy-report-schema.js";
import {
  buildDiscrepancyReport,
  DISCREPANCY_CATEGORIES,
  readDuplicateFindings,
  type DiscrepancyReport,
  type DiscrepancySourceHealth,
  type DuplicateObservation,
} from "../../src/application/discrepancy-report.js";
import {
  classifyIdentifierProvenance,
  withIssuingProvenance,
  type SourceHealthState,
} from "../../src/domain/identifier-provenance.js";
import type {
  InvalidRegistryHistory,
  NormalizedRegistryRecord,
  RegistryRole,
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
const ieTii = source("ie-tii", { jurisdictions: ["IE"] });
const deFirst = source("de-first", { jurisdictions: ["DE"] });
const deSecond = source("de-second", { jurisdictions: ["DE"] });
const frSecondary = source("fr-secondary", { jurisdictions: ["FR"], level: "SECONDARY" });

const allSources = [
  plEipa,
  benelux,
  dkFstyr,
  seEnergimyndigheten,
  cyDisabled,
  atLadestellen,
  evroam,
  ieTii,
  deFirst,
  deSecond,
  frSecondary,
];

const allCurrent: Record<string, SourceHealthState> = Object.fromEntries(
  allSources.map((entry) => [entry.id, "CURRENT" as const]),
);

interface Row {
  name: string;
  records: NormalizedRegistryRecord[];
  health?: Record<string, SourceHealthState>;
  sources?: SourceDefinition[];
  expected: string[];
}

// Each finding reads `CATEGORY issuing>observed eMobilityId severity/confidence [reason]`.
const rows: Row[] = [
  {
    name: "a Polish identifier listed elsewhere and absent from pl-eipa is not found",
    records: [record("benelux-idro", "PL", "XYZ")],
    expected: ["NOT_FOUND_IN_ISSUING_REGISTER pl-eipa>benelux-idro PLXYZ high/high"],
  },
  {
    name: "a listing by a stale source lowers the confidence of a not-found",
    records: [record("benelux-idro", "PL", "XYZ")],
    health: { ...allCurrent, "benelux-idro": "STALE" },
    expected: [
      "NOT_FOUND_IN_ISSUING_REGISTER pl-eipa>benelux-idro PLXYZ high/medium",
      "SOURCE_STALE benelux-idro>benelux-idro - medium/high",
      "SOURCE_STALE benelux-idro>benelux-idro - medium/high",
      "SOURCE_STALE benelux-idro>benelux-idro - medium/high",
    ],
  },
  {
    name: "DK*MON listed in Sweden and confirmed by dk-fstyr is not reported",
    records: [record("se-energimyndigheten", "DK", "MON"), record("dk-fstyr", "DK", "MON")],
    expected: [],
  },
  {
    name: "an IE listing by a GB-only register absent from ie-tii is not found",
    records: [record("evroam", "IE", "ABC")],
    expected: ["NOT_FOUND_IN_ISSUING_REGISTER ie-tii>evroam IEABC high/high"],
  },
  {
    name: "a stale issuing register makes a listing unverifiable, never not found",
    records: [record("benelux-idro", "PL", "XYZ")],
    health: { ...allCurrent, "pl-eipa": "STALE" },
    expected: [
      "ISSUING_REGISTER_UNVERIFIABLE pl-eipa>benelux-idro PLXYZ info/low SOURCE_STALE",
      "SOURCE_STALE pl-eipa>pl-eipa - medium/high",
    ],
  },
  {
    name: "an unavailable issuing register makes a listing unverifiable",
    records: [record("benelux-idro", "PL", "XYZ")],
    health: { ...allCurrent, "pl-eipa": "UNAVAILABLE" },
    expected: [
      "ISSUING_REGISTER_UNVERIFIABLE pl-eipa>benelux-idro PLXYZ info/low SOURCE_UNAVAILABLE",
      "SOURCE_UNAVAILABLE pl-eipa>pl-eipa - medium/high",
    ],
  },
  {
    name: "an issuing register missing from the health map counts as unavailable",
    records: [record("benelux-idro", "PL", "XYZ")],
    health: withoutHealth("pl-eipa"),
    expected: [
      "ISSUING_REGISTER_UNVERIFIABLE pl-eipa>benelux-idro PLXYZ info/low SOURCE_UNAVAILABLE",
      "SOURCE_UNAVAILABLE pl-eipa>pl-eipa - medium/high",
    ],
  },
  {
    name: "a disabled issuing register makes a listing unverifiable without a source finding",
    records: [record("benelux-idro", "CY", "ABC")],
    expected: [
      "ISSUING_REGISTER_UNVERIFIABLE cy-like>benelux-idro CYABC info/low SOURCE_UNAVAILABLE",
    ],
  },
  {
    name: "a confirmed identifier listed elsewhere is not reported",
    records: [record("pl-eipa", "PL", "XYZ"), record("benelux-idro", "PL", "XYZ")],
    expected: [],
  },
  {
    name: "an issuing register listing another role gives a role conflict instead",
    records: [record("benelux-idro", "PL", "XYZ", "CPO"), record("pl-eipa", "PL", "XYZ", "EMSP")],
    expected: ["CONFLICTING_ROLE pl-eipa>benelux-idro PLXYZ medium/high"],
  },
  {
    name: "a role conflict is reported once per identifier and listing register",
    sources: [benelux, source("pl-eipa", { jurisdictions: ["PL"], roles: ["CPO", "EMSP", "NSP"] })],
    health: { "benelux-idro": "CURRENT", "pl-eipa": "CURRENT" },
    records: [
      record("benelux-idro", "PL", "XYZ", "CPO"),
      record("benelux-idro", "PL", "XYZ", "EMSP"),
      record("pl-eipa", "PL", "XYZ", "NSP"),
    ],
    expected: ["CONFLICTING_ROLE pl-eipa>benelux-idro PLXYZ medium/high"],
  },
  {
    name: "a removal from a current issuing register is reported",
    records: [record("pl-eipa", "PL", "OLD", "CPO", { tombstone: true })],
    expected: ["REMOVED_FROM_ISSUING_REGISTER pl-eipa>pl-eipa PLOLD medium/high"],
  },
  {
    name: "a removed identifier still listed elsewhere is also not found",
    records: [
      record("pl-eipa", "PL", "OLD", "CPO", { tombstone: true }),
      record("benelux-idro", "PL", "OLD"),
    ],
    expected: [
      "NOT_FOUND_IN_ISSUING_REGISTER pl-eipa>benelux-idro PLOLD high/high",
      "REMOVED_FROM_ISSUING_REGISTER pl-eipa>pl-eipa PLOLD medium/high",
    ],
  },
  {
    name: "a removal from a stale issuing register is unverifiable, never a removal",
    records: [record("pl-eipa", "PL", "OLD", "CPO", { tombstone: true })],
    health: { ...allCurrent, "pl-eipa": "STALE" },
    expected: [
      "ISSUING_REGISTER_UNVERIFIABLE pl-eipa>pl-eipa PLOLD info/low SOURCE_STALE",
      "SOURCE_STALE pl-eipa>pl-eipa - medium/high",
    ],
  },
  {
    name: "a removal from one issuing register is reported though another still lists it",
    records: [
      record("de-first", "DE", "OLD", "CPO", { tombstone: true }),
      record("de-second", "DE", "OLD"),
    ],
    expected: ["REMOVED_FROM_ISSUING_REGISTER de-first>de-first DEOLD medium/high"],
  },
  {
    name: "a removal from a stale issuing register another still lists is unverifiable",
    records: [
      record("de-first", "DE", "OLD", "CPO", { tombstone: true }),
      record("de-second", "DE", "OLD"),
    ],
    health: { ...allCurrent, "de-first": "STALE" },
    expected: [
      "ISSUING_REGISTER_UNVERIFIABLE de-first>de-first DEOLD info/low SOURCE_STALE",
      "SOURCE_STALE de-first>de-first - medium/high",
    ],
  },
  {
    name: "a role the country's register does not publish is outside its scope",
    records: [record("benelux-idro", "AT", "ABC", "EMSP")],
    expected: [
      "OUTSIDE_ISSUING_REGISTER_SCOPE at-ladestellen>benelux-idro ATABC info/high ROLE_NOT_PUBLISHED",
    ],
  },
  {
    name: "a country no register covers is outside any issuing register's scope",
    records: [record("benelux-idro", "IT", "ABC")],
    expected: ["OUTSIDE_ISSUING_REGISTER_SCOPE ->benelux-idro ITABC info/high NO_ISSUING_REGISTER"],
  },
  {
    name: "an identifier new in the issuing register's latest retrieval is added",
    records: [record("pl-eipa", "PL", "NEW", "CPO", { firstSeenAt: RETRIEVED_AT })],
    expected: ["ADDED_TO_ISSUING_REGISTER pl-eipa>pl-eipa PLNEW info/high"],
  },
  {
    name: "records a non-current issuing register carries over are never added",
    records: [record("pl-eipa", "PL", "NEW", "CPO", { firstSeenAt: RETRIEVED_AT })],
    health: { ...allCurrent, "pl-eipa": "STALE" },
    expected: ["SOURCE_STALE pl-eipa>pl-eipa - medium/high"],
  },
  {
    name: "each non-current issuing register gives its own state as the reason",
    records: [record("benelux-idro", "DE", "XYZ")],
    health: { ...allCurrent, "de-first": "STALE", "de-second": "UNAVAILABLE" },
    expected: [
      "ISSUING_REGISTER_UNVERIFIABLE de-first>benelux-idro DEXYZ info/low SOURCE_STALE",
      "ISSUING_REGISTER_UNVERIFIABLE de-second>benelux-idro DEXYZ info/low SOURCE_UNAVAILABLE",
      "SOURCE_STALE de-first>de-first - medium/high",
      "SOURCE_UNAVAILABLE de-second>de-second - medium/high",
    ],
  },
  {
    name: "a second issuing register that does not list the identifier still gives a not-found",
    records: [record("benelux-idro", "DE", "XYZ", "CPO"), record("de-first", "DE", "XYZ", "EMSP")],
    expected: [
      "CONFLICTING_ROLE de-first>benelux-idro DEXYZ medium/high",
      "NOT_FOUND_IN_ISSUING_REGISTER de-second>benelux-idro DEXYZ high/high",
    ],
  },
  {
    name: "a register that does not publish the listing's role is not cited in a role conflict",
    sources: [
      benelux,
      source("de-first", { jurisdictions: ["DE"], roles: ["CPO"] }),
      source("de-second", { jurisdictions: ["DE"], roles: ["CPO", "EMSP"] }),
    ],
    health: { "benelux-idro": "CURRENT", "de-first": "CURRENT", "de-second": "CURRENT" },
    records: [record("benelux-idro", "DE", "XYZ", "EMSP"), record("de-first", "DE", "XYZ", "CPO")],
    expected: ["NOT_FOUND_IN_ISSUING_REGISTER de-second>benelux-idro DEXYZ high/high"],
  },
  {
    name: "a current issuing register lacking a listing gives a not-found while another is unavailable",
    records: [record("benelux-idro", "DE", "XYZ")],
    health: { ...allCurrent, "de-second": "UNAVAILABLE" },
    expected: [
      "NOT_FOUND_IN_ISSUING_REGISTER de-first>benelux-idro DEXYZ high/high",
      "ISSUING_REGISTER_UNVERIFIABLE de-second>benelux-idro DEXYZ info/low SOURCE_UNAVAILABLE",
      "SOURCE_UNAVAILABLE de-second>de-second - medium/high",
    ],
  },
  {
    name: "a current issuing register's role conflict is reported while another is stale",
    records: [record("benelux-idro", "DE", "XYZ", "CPO"), record("de-first", "DE", "XYZ", "EMSP")],
    health: { ...allCurrent, "de-second": "STALE" },
    expected: [
      "CONFLICTING_ROLE de-first>benelux-idro DEXYZ medium/high",
      "ISSUING_REGISTER_UNVERIFIABLE de-second>benelux-idro DEXYZ info/low SOURCE_STALE",
      "SOURCE_STALE de-second>de-second - medium/high",
    ],
  },
  {
    name: "a current issuing register lacking a listing another issuing register confirms gives a not-found",
    records: [record("benelux-idro", "DE", "XYZ"), record("de-first", "DE", "XYZ")],
    expected: ["NOT_FOUND_IN_ISSUING_REGISTER de-second>benelux-idro DEXYZ high/high"],
  },
  {
    name: "organisation names that differ after normalisation conflict",
    records: [
      record("pl-eipa", "PL", "XYZ", "CPO", { name: "Acme Energy" }),
      record("benelux-idro", "PL", "XYZ", "CPO", { name: "Acme Mobility" }),
    ],
    expected: ["CONFLICTING_NAME pl-eipa>benelux-idro PLXYZ low/medium"],
  },
  {
    name: "two issuing registers publishing different names conflict once",
    records: [
      record("de-first", "DE", "XYZ", "CPO", { name: "Acme Energy" }),
      record("de-second", "DE", "XYZ", "CPO", { name: "Acme Mobility" }),
    ],
    expected: ["CONFLICTING_NAME de-first>de-second DEXYZ low/medium"],
  },
  {
    name: "issuing registers are compared with each other and with the other sources, each pair once",
    records: [
      record("de-first", "DE", "XYZ", "CPO", { name: "Acme Energy" }),
      record("de-second", "DE", "XYZ", "CPO", { name: "Acme Mobility" }),
      record("benelux-idro", "DE", "XYZ", "CPO", { name: "Acme Mobility" }),
    ],
    expected: [
      "CONFLICTING_NAME de-first>benelux-idro DEXYZ low/medium",
      "CONFLICTING_NAME de-first>de-second DEXYZ low/medium",
    ],
  },
  {
    name: "two issuing registers publishing different statuses conflict once",
    records: [
      record("de-first", "DE", "XYZ"),
      record("de-second", "DE", "XYZ", "CPO", { status: "REVOKED" }),
    ],
    expected: ["CONFLICTING_STATUS de-first>de-second DEXYZ medium/high"],
  },
  {
    name: "a conflict between issuing registers loses confidence when one is stale",
    records: [
      record("de-first", "DE", "XYZ"),
      record("de-second", "DE", "XYZ", "CPO", { status: "REVOKED" }),
    ],
    health: { ...allCurrent, "de-second": "STALE" },
    expected: [
      "CONFLICTING_STATUS de-first>de-second DEXYZ medium/medium",
      "SOURCE_STALE de-second>de-second - medium/high",
    ],
  },
  {
    name: "names differing only by case, spacing or punctuation do not conflict",
    records: [
      record("pl-eipa", "PL", "XYZ", "CPO", { name: "Acme  Energy, S.A." }),
      record("benelux-idro", "PL", "XYZ", "CPO", { name: "ACME energy SA" }),
    ],
    expected: [],
  },
  {
    name: "without an issuing record, names are compared with the first register",
    records: [
      record("benelux-idro", "PL", "XYZ", "CPO", { name: "Acme Energy" }),
      record("se-energimyndigheten", "PL", "XYZ", "CPO", { name: "Other Energy" }),
    ],
    expected: [
      "CONFLICTING_NAME ->se-energimyndigheten PLXYZ low/medium",
      "NOT_FOUND_IN_ISSUING_REGISTER pl-eipa>benelux-idro PLXYZ high/high",
      "NOT_FOUND_IN_ISSUING_REGISTER pl-eipa>se-energimyndigheten PLXYZ high/high",
    ],
  },
  {
    name: "statuses that differ conflict",
    records: [
      record("pl-eipa", "PL", "XYZ"),
      record("benelux-idro", "PL", "XYZ", "CPO", { status: "REVOKED" }),
    ],
    expected: ["CONFLICTING_STATUS pl-eipa>benelux-idro PLXYZ medium/high"],
  },
  {
    name: "a name conflict with a stale source lowers its confidence",
    records: [
      record("pl-eipa", "PL", "XYZ", "CPO", { name: "Acme Energy" }),
      record("benelux-idro", "PL", "XYZ", "CPO", { name: "Acme Mobility" }),
    ],
    health: { ...allCurrent, "benelux-idro": "STALE" },
    expected: [
      "CONFLICTING_NAME pl-eipa>benelux-idro PLXYZ low/low",
      "SOURCE_STALE benelux-idro>benelux-idro - medium/high",
      "SOURCE_STALE benelux-idro>benelux-idro - medium/high",
      "SOURCE_STALE benelux-idro>benelux-idro - medium/high",
    ],
  },
  {
    name: "a status conflict with a stale source lowers its confidence",
    records: [
      record("pl-eipa", "PL", "XYZ"),
      record("benelux-idro", "PL", "XYZ", "CPO", { status: "REVOKED" }),
    ],
    health: { ...allCurrent, "benelux-idro": "STALE" },
    expected: [
      "CONFLICTING_STATUS pl-eipa>benelux-idro PLXYZ medium/medium",
      "SOURCE_STALE benelux-idro>benelux-idro - medium/high",
      "SOURCE_STALE benelux-idro>benelux-idro - medium/high",
      "SOURCE_STALE benelux-idro>benelux-idro - medium/high",
    ],
  },
  {
    name: "a status conflict with an unavailable source lowers its confidence",
    records: [
      record("pl-eipa", "PL", "XYZ"),
      record("benelux-idro", "PL", "XYZ", "CPO", { status: "REVOKED" }),
    ],
    health: { ...allCurrent, "benelux-idro": "UNAVAILABLE" },
    expected: [
      "CONFLICTING_STATUS pl-eipa>benelux-idro PLXYZ medium/medium",
      "SOURCE_UNAVAILABLE benelux-idro>benelux-idro - medium/high",
      "SOURCE_UNAVAILABLE benelux-idro>benelux-idro - medium/high",
      "SOURCE_UNAVAILABLE benelux-idro>benelux-idro - medium/high",
    ],
  },
  {
    name: "an UNKNOWN status never conflicts",
    records: [
      record("pl-eipa", "PL", "XYZ"),
      record("benelux-idro", "PL", "XYZ", "CPO", { status: "UNKNOWN" }),
    ],
    expected: [],
  },
  {
    name: "a stale non-authoritative source is a low-severity finding",
    records: [record("fr-secondary", "FR", "ABC")],
    health: { ...allCurrent, "fr-secondary": "STALE" },
    expected: [
      "OUTSIDE_ISSUING_REGISTER_SCOPE ->fr-secondary FRABC info/high NO_ISSUING_REGISTER",
      "SOURCE_STALE ->fr-secondary - low/high",
    ],
  },
];

describe("buildDiscrepancyReport", () => {
  it.each(rows)("$name", ({ records, health, sources, expected }) => {
    const report = build({ records, health, sources });
    expect(compact(report).sort()).toEqual([...expected].sort());
  });

  it("links every finding to its records and retrieval timestamps", () => {
    const report = build({ records: [record("benelux-idro", "PL", "XYZ")] });
    const [finding] = findings(report);
    expect(finding).toMatchObject({
      countryCode: "PL",
      identifier: { countryCode: "PL", partyId: "XYZ", role: "CPO", eMobilityId: "PLXYZ" },
      issuingConfirmation: "NOT_FOUND",
      evidence: [
        {
          recordKey: "benelux-idro:PL:XYZ:CPO",
          registryId: "benelux-idro",
          retrievedAt: RETRIEVED_AT,
          lastSeenAt: RETRIEVED_AT,
        },
        { recordKey: null, registryId: "pl-eipa", retrievedAt: RETRIEVED_AT, lastSeenAt: null },
      ],
    });
  });

  it("lowers a conflict's confidence when the issuing side is not current", () => {
    const report = build({
      records: [
        record("pl-eipa", "PL", "XYZ"),
        record("benelux-idro", "PL", "XYZ", "CPO", { status: "REVOKED" }),
      ],
      health: { ...allCurrent, "pl-eipa": "STALE" },
    });
    const conflict = findings(report).find((finding) => finding.category === "CONFLICTING_STATUS");
    expect(conflict).toMatchObject({ severity: "medium", confidence: "medium" });
  });

  it("gives each conflicting record the effective health of its source", () => {
    const report = build({
      records: [
        record("pl-eipa", "PL", "XYZ", "CPO", { name: "Acme Energy" }),
        record("benelux-idro", "PL", "XYZ", "CPO", { name: "Acme Mobility" }),
      ],
      health: { ...allCurrent, "benelux-idro": "STALE" },
    });
    const conflict = findings(report).find((finding) => finding.category === "CONFLICTING_NAME");
    expect(conflict?.evidence).toEqual([
      expect.objectContaining({ registryId: "benelux-idro", healthState: "STALE" }),
      expect.objectContaining({ registryId: "pl-eipa", healthState: "CURRENT" }),
    ]);
  });

  it("keeps the identifier's confirmation on a removal another issuing register contradicts", () => {
    const report = build({
      records: [
        record("de-first", "DE", "OLD", "CPO", { tombstone: true }),
        record("de-second", "DE", "OLD"),
      ],
    });
    expect(findings(report)).toEqual([
      expect.objectContaining({
        category: "REMOVED_FROM_ISSUING_REGISTER",
        issuingRegistryId: "de-first",
        observedRegistryId: "de-first",
        issuingConfirmation: "CONFIRMED",
      }),
    ]);
  });

  it("words a removal it cannot confirm as an absence from the last successful retrieval", () => {
    const report = build({
      records: [record("benelux-idro", "BE", "CVT", "CPO", { tombstone: true })],
      health: { ...allCurrent, "benelux-idro": "STALE" },
    });
    const unverifiable = findings(report).find(
      (finding) => finding.category === "ISSUING_REGISTER_UNVERIFIABLE",
    );
    expect(unverifiable?.summary).toBe(
      "BECVT (CPO) was missing from the last successful retrieval of benelux-idro, " +
        "which is not current now, so the absence cannot be confirmed.",
    );
  });

  it("reports each duplicate warning once, under the source's single jurisdiction", () => {
    const report = build({
      duplicates: [duplicate("pl-eipa"), duplicate("benelux-idro")],
    });
    expect(compact(report).sort()).toEqual([
      "DUPLICATE_IDENTIFIER benelux-idro>benelux-idro - low/high",
      "DUPLICATE_IDENTIFIER pl-eipa>pl-eipa - low/high",
    ]);
    expect(report.countries.map((country) => country.countryCode)).toEqual(["PL", null]);
  });

  it("reports malformed identifiers with neutral reasons and detection timestamps", () => {
    const report = build({ invalidHistory: malformedHistory() });
    expect(compact(report).sort()).toEqual([
      "MALFORMED_IDENTIFIER pl-eipa>pl-eipa - low/high IDENTIFIER_NOT_PARSEABLE",
      "MALFORMED_IDENTIFIER pl-eipa>pl-eipa P1XYZ low/high COUNTRY_CODE_NOT_RECOGNISED",
      "MALFORMED_IDENTIFIER pl-eipa>pl-eipa PLX low/high PARTY_ID_NOT_RECOGNISED",
    ]);
    const row = findings(report).find((finding) => finding.identifier === null);
    expect(row?.evidence).toEqual([
      expect.objectContaining({
        recordKey: null,
        registryId: "pl-eipa",
        firstDetectedAt: EARLIER,
        lastDetectedAt: RETRIEVED_AT,
      }),
    ]);
  });

  it("counts every category and severity, in a fixed order", () => {
    const report = build({ records: [record("benelux-idro", "PL", "XYZ")] });
    expect(Object.keys(report.summary.byCategory)).toEqual([...DISCREPANCY_CATEGORIES]);
    expect(Object.keys(report.summary.bySeverity)).toEqual(["high", "medium", "low", "info"]);
    expect(report.summary).toMatchObject({
      totalFindings: 1,
      byCategory: { NOT_FOUND_IN_ISSUING_REGISTER: 1, CONFLICTING_NAME: 0 },
      bySeverity: { high: 1, info: 0 },
    });
  });

  it("covers every category without describing anything as invalid or an error", () => {
    const report = everyCategoryReport();
    for (const category of DISCREPANCY_CATEGORIES) {
      expect(report.summary.byCategory[category], category).toBeGreaterThan(0);
    }
    expect(JSON.stringify(report)).not.toMatch(/invalid|error/i);
  });

  it("matches the published JSON schema, every category included", () => {
    const validator = z.fromJSONSchema(discrepanciesSchema as never);
    expect(validator.safeParse(everyCategoryReport()).error).toBeUndefined();
  });

  it("does not depend on the order of its inputs", () => {
    const input = everyCategoryInput();
    const permuted = {
      ...input,
      records: shuffle(input.records),
      sources: [...input.sources].reverse(),
      health: Object.fromEntries(Object.entries(input.health).reverse()),
      invalidHistory: {
        records: [...input.invalidHistory.records].reverse(),
        rows: [...input.invalidHistory.rows].reverse(),
      },
      duplicates: [...input.duplicates].reverse(),
    };
    expect(JSON.stringify(buildDiscrepancyReport(permuted))).toBe(
      JSON.stringify(buildDiscrepancyReport(input)),
    );
  });

  it("orders countries, then pairs with a null issuing register last", () => {
    const report = everyCategoryReport();
    const codes = report.countries.map((country) => country.countryCode);
    expect(codes.at(-1)).toBeNull();
    expect(codes.slice(0, -1)).toEqual(
      codes.slice(0, -1).sort((left, right) => (String(left) < String(right) ? -1 : 1)),
    );
    for (const country of report.countries) {
      const issuing = country.pairs.map((pair) => pair.issuingRegistryId);
      const firstNull = issuing.indexOf(null);
      if (firstNull >= 0) expect(issuing.slice(firstNull).every((id) => id === null)).toBe(true);
    }
  });
});

describe("readDuplicateFindings", () => {
  it("reads back the duplicates a report was built from", () => {
    const duplicates = [duplicate("pl-eipa"), duplicate("benelux-idro"), duplicate("ghost")];
    const report = build({ duplicates });
    const sortKey = (entry: DuplicateObservation) => `${entry.sourceId}|${entry.message}`;
    const sorted = (entries: DuplicateObservation[]) =>
      [...entries].sort((left, right) => (sortKey(left) < sortKey(right) ? -1 : 1));
    expect(sorted(readDuplicateFindings(report))).toEqual(sorted(duplicates));
    expect(build({ duplicates: readDuplicateFindings(report) })).toEqual(report);
  });
});

function build(options: BuildOptions): DiscrepancyReport {
  return buildDiscrepancyReport(input(options));
}

interface BuildOptions {
  records?: NormalizedRegistryRecord[] | undefined;
  health?: Record<string, SourceHealthState> | undefined;
  sources?: SourceDefinition[] | undefined;
  invalidHistory?: Pick<InvalidRegistryHistory, "records" | "rows"> | undefined;
  duplicates?: DuplicateObservation[] | undefined;
}

function input(options: BuildOptions) {
  const sources = options.sources ?? allSources;
  const states = options.health ?? allCurrent;
  const records = options.records ?? [];
  const classification = classifyIdentifierProvenance(records, sources, states);
  const health: Record<string, DiscrepancySourceHealth> = Object.fromEntries(
    Object.entries(states).map(([id, state]) => [
      id,
      { state, lastSuccessfulRetrieval: state === "UNAVAILABLE" ? EARLIER : RETRIEVED_AT },
    ]),
  );
  return {
    records: withIssuingProvenance(records, classification),
    sources,
    health,
    invalidHistory: options.invalidHistory ?? { records: [], rows: [] },
    duplicates: options.duplicates ?? [],
    generatedAt: RETRIEVED_AT,
  };
}

function everyCategoryInput() {
  return input({
    records: [
      record("benelux-idro", "PL", "XYZ", "CPO", { name: "Acme Energy" }),
      record("se-energimyndigheten", "PL", "XYZ", "CPO", { name: "Other Energy" }),
      record("benelux-idro", "DK", "ROL", "CPO"),
      record("dk-fstyr", "DK", "ROL", "EMSP"),
      record("dk-fstyr", "DK", "OLD", "CPO", { tombstone: true }),
      record("dk-fstyr", "DK", "NEW", "CPO", { firstSeenAt: RETRIEVED_AT }),
      record("dk-fstyr", "DK", "STA"),
      record("se-energimyndigheten", "DK", "STA", "CPO", { status: "REVOKED" }),
      record("benelux-idro", "CY", "ABC"),
      record("benelux-idro", "IT", "ABC"),
      record("benelux-idro", "AT", "ABC", "EMSP"),
      record("fr-secondary", "FR", "ABC"),
      record("ie-tii", "IE", "ABC"),
      record("ie-tii", "IE", "OLD", "CPO", { tombstone: true }),
      record("evroam", "IE", "GBL"),
    ],
    health: { ...allCurrent, "fr-secondary": "STALE", "ie-tii": "UNAVAILABLE" },
    invalidHistory: malformedHistory(),
    duplicates: [duplicate("pl-eipa"), duplicate("benelux-idro"), duplicate("ghost")],
  });
}

function everyCategoryReport() {
  return buildDiscrepancyReport(everyCategoryInput());
}

function malformedHistory(): Pick<InvalidRegistryHistory, "records" | "rows"> {
  const detection = { firstDetectedAt: EARLIER, lastDetectedAt: RETRIEVED_AT, supersededBy: null };
  return {
    records: [
      {
        reasons: ["INVALID_COUNTRY"],
        record: record("pl-eipa", "P1", "XYZ"),
        ...detection,
      },
      { reasons: ["INVALID_PARTY_ID"], record: record("pl-eipa", "PL", "X"), ...detection },
    ],
    rows: [
      {
        registryId: "pl-eipa",
        code: "EIPA_INVALID_IDENTIFIER",
        sourceValue: "???",
        message: "Invalid identifier ??? (parse error).",
        ...detection,
      },
    ],
  };
}

function duplicate(sourceId: string): DuplicateObservation {
  return {
    sourceId,
    code: "EXAMPLE_DUPLICATE_IDENTIFIER",
    message: `Duplicate ${sourceId} identifier PL*DUP for CPO.`,
    retrievedAt: RETRIEVED_AT,
  };
}

function findings(report: DiscrepancyReport) {
  return report.countries.flatMap((country) => country.pairs.flatMap((pair) => pair.findings));
}

function compact(report: DiscrepancyReport) {
  return findings(report).map((finding) =>
    [
      finding.category,
      `${finding.issuingRegistryId ?? "-"}>${finding.observedRegistryId}`,
      finding.identifier?.eMobilityId ?? "-",
      `${finding.severity}/${finding.confidence}`,
      ...(finding.reason ? [finding.reason] : []),
    ].join(" "),
  );
}

// A fixed permutation: deterministic, and it moves every element.
function shuffle<T>(items: T[]): T[] {
  return items.map((_, index) => items[(index * 7 + 3) % items.length] as T);
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
    name?: string;
    firstSeenAt?: string;
  } = {},
): NormalizedRegistryRecord {
  return {
    key: `${registryId}:${countryCode}:${partyId}:${role}`,
    countryCode,
    partyId,
    eMobilityId: `${countryCode}${partyId}`,
    role,
    status: options.tombstone ? "INACTIVE" : (options.status ?? "ACTIVE"),
    organization: { name: options.name ?? "Example", legalName: null, website: null },
    source: {
      registryId,
      official: false,
      sourceRecordId: `${countryCode}${partyId}`,
      sourceUrl: "https://example.test/",
      sourceValue: `${countryCode}*${partyId}`,
      firstSeenAt: options.firstSeenAt ?? EARLIER,
      lastSeenAt: options.tombstone ? EARLIER : RETRIEVED_AT,
      retrievedAt: RETRIEVED_AT,
    },
    metadata: options.tombstone ? { inactiveReason: "missing-from-official-source" } : {},
  };
}
