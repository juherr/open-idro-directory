import { describe, expect, it } from "vitest";
import { EvroamConnector } from "../../src/connectors/gb-evroam/evroam.connector.js";
import { loadSourceDefinition } from "../../src/infrastructure/filesystem/source-loader.js";
import {
  coversJurisdiction,
  rejectedIdentifierWarning,
} from "../../src/validation/identifier-scope.js";

const REJECTION = { codePrefix: "EIPA", subject: "EIPA identifier" };

describe("identifier scope", () => {
  it("reads the covered jurisdictions from the source descriptor", async () => {
    // EV Roam's authority spans GB and IE, but its register only assigns GB
    // identifiers: TII is the Irish registrar.
    const evroam = await loadSourceDefinition("gb-evroam");
    const tii = await loadSourceDefinition("ie-tii");

    expect(coversJurisdiction(evroam, "GB")).toBe(true);
    expect(coversJurisdiction(evroam, "gb")).toBe(true);
    expect(coversJurisdiction(evroam, "IE")).toBe(false);
    expect(coversJurisdiction(tii, "ie")).toBe(true);
  });

  it("reports a value the connector could not read as malformed", async () => {
    const source = await loadSourceDefinition("pl-eipa");

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
});

describe("connector jurisdiction scope", () => {
  it("publishes EV Roam's Irish entries as listings observed in GB", async () => {
    const source = await loadSourceDefinition("gb-evroam");
    const connector = new EvroamConnector();

    const result = await connector.normalize({
      source,
      retrievedAt: "2026-06-15T00:00:00.000Z",
      records: [{ title: "Example Operator", operatorIdIE: "IE*ABC", website: null }],
    });

    expect(result.records.map((record) => record.countryCode)).toEqual(["IE"]);
    expect(result.records[0]?.source).toMatchObject({
      official: false,
      observation: { kind: "CROSS_REGISTER_LISTING", observingJurisdiction: "GB" },
    });
    expect(result.warnings).toHaveLength(0);
  });
});
