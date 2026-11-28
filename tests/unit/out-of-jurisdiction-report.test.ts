import { describe, expect, it } from "vitest";
import { buildOutOfJurisdictionReport } from "../../src/application/out-of-jurisdiction-report.js";
import { observationScope } from "../../src/domain/registry-observation.js";
import {
  makeRegistryKey,
  type NormalizedRegistryRecord,
  type RegistryRole,
} from "../../src/domain/registry-record.js";
import { loadSourceDefinitions } from "../../src/infrastructure/filesystem/source-loader.js";

const RUN = "2026-08-07T00:00:00.000Z";
const EARLIER_RUN = "2026-07-27T00:00:00.000Z";

describe("out-of-jurisdiction report", () => {
  it("groups the cross-register listings under the register that publishes them", async () => {
    const sources = await loadSourceDefinitions();

    // Scenario 2 of #91: Poland lists a Dutch identifier.
    const report = buildOutOfJurisdictionReport([await listing("pl-eipa", "NL*TNM")], sources, RUN);

    const register = report.registers[0];
    expect(register?.registryId).toBe("pl-eipa");
    expect(register?.authority.name).toBe("Urząd Dozoru Technicznego");
    expect(register?.authority.homepageUrl).toMatch(/^https:\/\//);
    expect(register?.jurisdictions).toEqual(["PL"]);
    expect(register?.identifiers).toEqual([
      {
        sourceValue: "NL*TNM",
        countryCode: "NL",
        firstDetectedAt: EARLIER_RUN,
        lastDetectedAt: RUN,
        administeredBy: expect.objectContaining({ registryId: "benelux-idro" }),
      },
    ]);
    expect(report.totalIdentifiers).toBe(1);
  });

  it("names the Danish register for an identifier Sweden observes", async () => {
    const sources = await loadSourceDefinitions();

    // Scenario 3 of #91: DK*MON observed in Sweden through OCPI.
    const report = buildOutOfJurisdictionReport(
      [await listing("se-energimyndigheten", "DK*MON")],
      sources,
      RUN,
    );

    expect(report.registers[0]?.registryId).toBe("se-energimyndigheten");
    expect(report.registers[0]?.identifiers[0]).toMatchObject({
      sourceValue: "DK*MON",
      countryCode: "DK",
      administeredBy: { registryId: "dk-fstyr" },
    });
  });

  it("points an Irish EV Roam entry at the Irish register", async () => {
    const sources = await loadSourceDefinitions();

    const report = buildOutOfJurisdictionReport(
      [await listing("gb-evroam", "IE*ABC")],
      sources,
      RUN,
    );

    expect(report.registers[0]?.identifiers[0]?.administeredBy).toMatchObject({
      registryId: "ie-tii",
    });
  });

  it("leaves the appointed registry empty for a country this directory does not cover", async () => {
    const sources = await loadSourceDefinitions();

    const report = buildOutOfJurisdictionReport([await listing("pl-eipa", "NO*ABC")], sources, RUN);

    expect(report.registers[0]?.identifiers[0]?.administeredBy).toBeNull();
  });

  it("leaves assignments out", async () => {
    const sources = await loadSourceDefinitions();

    // Scenario 1 of #91: PL*XYZ assigned and listed by the Polish register.
    const report = buildOutOfJurisdictionReport([await listing("pl-eipa", "PL*XYZ")], sources, RUN);

    expect(report.registers).toEqual([]);
    expect(report.totalIdentifiers).toBe(0);
  });

  it("derives the listing of a record published before the observation block", async () => {
    const sources = await loadSourceDefinitions();
    const legacy = await listing("pl-eipa", "NL*TNM");
    delete legacy.source.observation;

    const report = buildOutOfJurisdictionReport([legacy], sources, RUN);

    expect(report.registers[0]?.identifiers.map((entry) => entry.sourceValue)).toEqual(["NL*TNM"]);
  });

  it("lists an identifier once across its roles, over the widest period", async () => {
    const sources = await loadSourceDefinitions();
    const cpo = await listing("se-energimyndigheten", "DK*MON", "CPO");
    const emsp = await listing("se-energimyndigheten", "DK*MON", "EMSP");
    emsp.source.firstSeenAt = "2026-07-01T00:00:00.000Z";
    cpo.source.lastSeenAt = "2026-08-01T00:00:00.000Z";

    const report = buildOutOfJurisdictionReport([cpo, emsp], sources, RUN);

    expect(report.totalIdentifiers).toBe(1);
    expect(report.registers[0]?.identifiers[0]).toMatchObject({
      firstDetectedAt: "2026-07-01T00:00:00.000Z",
      lastDetectedAt: RUN,
    });
  });

  it("lists an identifier once when its roles spell it differently", async () => {
    const sources = await loadSourceDefinitions();
    const cpo = await listing("pl-eipa", "NL*TNM", "CPO");
    const emsp = await listing("pl-eipa", "NL*TNM", "EMSP");
    emsp.source.sourceValue = "NLTNM";
    emsp.source.firstSeenAt = "2026-07-01T00:00:00.000Z";

    const forward = buildOutOfJurisdictionReport([cpo, emsp], sources, RUN);
    const reversed = buildOutOfJurisdictionReport([emsp, cpo], sources, RUN);

    expect(forward.totalIdentifiers).toBe(1);
    expect(forward).toEqual(reversed);
    expect(forward.registers[0]?.identifiers[0]).toMatchObject({
      sourceValue: "NL*TNM",
      firstDetectedAt: "2026-07-01T00:00:00.000Z",
      lastDetectedAt: RUN,
    });
  });

  it("orders registers and identifiers whatever the record order", async () => {
    const sources = await loadSourceDefinitions();
    const records = [
      await listing("se-energimyndigheten", "DK*MON"),
      await listing("pl-eipa", "NO*ABC"),
      await listing("pl-eipa", "NL*TNM"),
    ];

    const forward = buildOutOfJurisdictionReport(records, sources, RUN);
    const reversed = buildOutOfJurisdictionReport([...records].reverse(), sources, RUN);

    expect(forward).toEqual(reversed);
    expect(forward.registers.map((register) => register.registryId)).toEqual([
      "pl-eipa",
      "se-energimyndigheten",
    ]);
    expect(forward.registers[0]?.identifiers.map((entry) => entry.sourceValue)).toEqual([
      "NL*TNM",
      "NO*ABC",
    ]);
  });

  it("ignores records of a register this directory no longer describes", async () => {
    const sources = await loadSourceDefinitions();
    const orphan = await listing("pl-eipa", "NL*TNM");
    orphan.source.registryId = "retired-register";

    const report = buildOutOfJurisdictionReport([orphan], sources, RUN);

    expect(report.registers).toEqual([]);
  });
});

async function listing(
  registryId: string,
  value: string,
  role: RegistryRole = "CPO",
): Promise<NormalizedRegistryRecord> {
  const sources = await loadSourceDefinitions();
  const source = sources.find((candidate) => candidate.id === registryId);
  if (!source) throw new Error(`Unknown source ${registryId}`);
  const [countryCode = "", partyId = ""] = value.split("*");
  return {
    key: makeRegistryKey(registryId, countryCode, partyId, role),
    countryCode,
    partyId,
    eMobilityId: `${countryCode}${partyId}`,
    role,
    status: "ACTIVE",
    organization: { name: "Example operator", legalName: null, website: null },
    source: {
      registryId,
      official: false,
      sourceRecordId: null,
      sourceUrl: "https://example.org/register",
      sourceValue: value,
      firstSeenAt: EARLIER_RUN,
      lastSeenAt: RUN,
      retrievedAt: RUN,
      observation: observationScope(source, countryCode),
    },
    metadata: {},
  };
}
