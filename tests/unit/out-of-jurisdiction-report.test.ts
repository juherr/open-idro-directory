import { describe, expect, it } from "vitest";
import { buildOutOfJurisdictionReport } from "../../src/application/out-of-jurisdiction-report.js";
import type { InvalidRegistryHistory } from "../../src/domain/registry-record.js";
import { loadSourceDefinitions } from "../../src/infrastructure/filesystem/source-loader.js";

const RUN = "2026-08-07T00:00:00.000Z";
const EARLIER_RUN = "2026-07-27T00:00:00.000Z";

describe("out-of-jurisdiction report", () => {
  it("groups the findings under the register to contact", async () => {
    const sources = await loadSourceDefinitions();

    const report = buildOutOfJurisdictionReport(history([entry("NL*TNM", "NL")]), sources, RUN);

    const register = report.registers[0];
    expect(register?.registryId).toBe("pl-eipa");
    expect(register?.contact.authorityName).toBe("Urząd Dozoru Technicznego");
    expect(register?.contact.homepageUrl).toMatch(/^https:\/\//);
    expect(register?.jurisdictions).toEqual(["PL"]);
    expect(register?.identifierCount).toBe(1);
  });

  it("names the registry appointed for the country the identifier belongs to", async () => {
    const sources = await loadSourceDefinitions();

    const report = buildOutOfJurisdictionReport(history([entry("NL*TNM", "NL")]), sources, RUN);

    // Knowing who administers NL is what makes the finding verifiable.
    expect(report.registers[0]?.identifiers[0]?.administeredBy).toMatchObject({
      sourceId: "benelux-idro",
    });
  });

  it("leaves the appointed registry empty for a country this directory does not cover", async () => {
    const sources = await loadSourceDefinitions();

    const report = buildOutOfJurisdictionReport(history([entry("NO*ABC", "NO")]), sources, RUN);

    expect(report.registers[0]?.identifiers[0]?.administeredBy).toBeNull();
  });

  it("lists only what the current run still sees", async () => {
    const sources = await loadSourceDefinitions();
    const corrected = {
      ...entry("NL*TNM", "NL"),
      firstDetectedAt: EARLIER_RUN,
      lastDetectedAt: EARLIER_RUN,
    };

    const report = buildOutOfJurisdictionReport(history([corrected]), sources, RUN);

    // The register fixed its export: it stays in the history, not in the report.
    expect(report.registers).toEqual([]);
    expect(report.totalIdentifiers).toBe(0);
  });
});

function history(
  outOfJurisdiction: InvalidRegistryHistory["outOfJurisdiction"],
): InvalidRegistryHistory {
  return { generatedAt: RUN, records: [], rows: [], outOfJurisdiction };
}

function entry(sourceValue: string, countryCode: string) {
  return {
    registryId: "pl-eipa",
    code: "EIPA_OUT_OF_JURISDICTION_IDENTIFIER",
    sourceValue,
    countryCode,
    message: `EIPA identifier ${sourceValue} belongs to ${countryCode}, outside ...`,
    firstDetectedAt: RUN,
    lastDetectedAt: RUN,
    supersededBy: null,
  };
}
