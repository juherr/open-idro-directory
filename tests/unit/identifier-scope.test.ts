import { describe, expect, it } from "vitest";
import { BeneluxIdroConnector } from "../../src/connectors/benelux-idro/benelux.connector.js";
import { EvroamConnector } from "../../src/connectors/gb-evroam/evroam.connector.js";
import { loadSourceDefinition } from "../../src/infrastructure/filesystem/source-loader.js";
import {
  coversJurisdiction,
  outOfJurisdictionWarning,
  rejectedIdentifierWarning,
} from "../../src/validation/identifier-scope.js";
import { toRejectedSourceRows } from "../../src/validation/identifier-validator.js";

const REJECTION = { codePrefix: "EIPA", subject: "EIPA identifier" };

describe("identifier scope", () => {
  it("reads the covered jurisdictions from the source descriptor", async () => {
    // EV Roam publishes the Irish identifiers it cross-registers, which is why
    // its descriptor declares both.
    const evroam = await loadSourceDefinition("gb-evroam");

    expect(coversJurisdiction(evroam, "IE")).toBe(true);
    expect(coversJurisdiction(evroam, "ie")).toBe(true);
    expect(coversJurisdiction(evroam, "FR")).toBe(false);
  });

  it("separates an identifier of another country from an unreadable one", async () => {
    const source = await loadSourceDefinition("pl-eipa");

    const foreign = rejectedIdentifierWarning(source, { ...REJECTION, value: "NL*TNM" });
    expect(foreign.code).toBe("EIPA_OUT_OF_JURISDICTION_IDENTIFIER");
    expect(foreign.message).toContain("belongs to NL");
    // Reported separately, so the rejected-row report keeps describing rows the
    // pipeline genuinely could not read.
    expect(foreign.rejectedIdentifier).toBeUndefined();

    const malformed = rejectedIdentifierWarning(source, { ...REJECTION, value: "37" });
    expect(malformed.code).toBe("EIPA_MALFORMED_IDENTIFIER");
    expect(malformed.message).toBe("Unexpected EIPA identifier syntax: 37");
    expect(malformed.rejectedIdentifier).toBe("37");
  });

  it("keeps an identifier of a covered country out of the rejection path", async () => {
    const source = await loadSourceDefinition("pl-eipa");

    const warning = rejectedIdentifierWarning(source, { ...REJECTION, value: "PL*ABC" });

    // The country is covered, so whatever the connector disliked is a format
    // problem and stays reported as such.
    expect(warning.code).toBe("EIPA_MALFORMED_IDENTIFIER");
  });

  it("treats a prefix that names no country as unreadable", async () => {
    const source = await loadSourceDefinition("pl-eipa");

    // ZZ, XX and the user-assigned ranges resolve to no register at all, so
    // calling them another country's identifier would hide a broken value.
    for (const value of ["ZZ*123", "XX-ABC", "UK*ABC"]) {
      const warning = rejectedIdentifierWarning(source, { ...REJECTION, value });
      expect(warning.code, value).toBe("EIPA_MALFORMED_IDENTIFIER");
      expect(warning.rejectedIdentifier, value).toBe(value);
    }
  });

  it("treats a homoglyph as unreadable rather than foreign", async () => {
    const source = await loadSourceDefinition("gr-electrokinisi");

    // The last character is a Greek capital tau, not a Latin T.
    const warning = rejectedIdentifierWarning(source, {
      codePrefix: "ELECTROKINISI",
      subject: "Greek IDRO identifier",
      value: "GR * FRΤ",
    });

    expect(warning.code).toBe("ELECTROKINISI_MALFORMED_IDENTIFIER");
    expect(warning.rejectedIdentifier).toBe("GR * FRΤ");
  });

  it("reports a value under the identifier the connector could not read", async () => {
    const source = await loadSourceDefinition("fr-afirev");

    const warning = rejectedIdentifierWarning(source, {
      codePrefix: "AFIREV",
      subject: "AFIREV prefix",
      value: "FRXYZW",
      reported: "raw-prefix-id",
    });

    expect(warning.rejectedIdentifier).toBe("raw-prefix-id");
  });

  it("excludes out-of-jurisdiction warnings from the rejected rows", async () => {
    const source = await loadSourceDefinition("pl-eipa");
    const warnings = [
      rejectedIdentifierWarning(source, { ...REJECTION, value: "NL*TNM" }),
      rejectedIdentifierWarning(source, { ...REJECTION, value: "37" }),
      outOfJurisdictionWarning(source, { ...REJECTION, value: "DE-QWC" }, "DE"),
    ];

    expect(toRejectedSourceRows("pl-eipa", warnings).map((row) => row.sourceValue)).toEqual(["37"]);
  });
});

describe("connector jurisdiction guard", () => {
  it("does not publish an identifier the register does not administer", async () => {
    const source = await loadSourceDefinition("benelux-idro");
    const connector = new BeneluxIdroConnector();

    const result = await connector.normalize({
      source,
      retrievedAt: "2026-06-15T00:00:00.000Z",
      records: [
        { companyName: "Example Operator", cpoIds: ["FR*XYZ"], emspIds: [], website: null },
      ],
    });

    expect(result.records).toHaveLength(0);
    expect(result.warnings[0]?.code).toBe("BENELUX_OUT_OF_JURISDICTION_IDENTIFIER");
    expect(result.warnings[0]?.message).toContain("BE, NL, LU");
  });

  it("publishes the countries the register declares, such as EV Roam's Irish entries", async () => {
    const source = await loadSourceDefinition("gb-evroam");
    const connector = new EvroamConnector();

    const result = await connector.normalize({
      source,
      retrievedAt: "2026-06-15T00:00:00.000Z",
      records: [{ title: "Example Operator", operatorIdIE: "IE*ABC", website: null }],
    });

    expect(result.records.map((record) => record.countryCode)).toEqual(["IE"]);
    expect(result.warnings).toHaveLength(0);
  });
});
