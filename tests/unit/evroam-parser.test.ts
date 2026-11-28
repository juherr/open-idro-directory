import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { applyOfficialStatusPolicy } from "../../src/application/official-status-policy.js";
import { EvroamConnector } from "../../src/connectors/gb-evroam/evroam.connector.js";
import { parseEvroamRegister } from "../../src/connectors/gb-evroam/evroam.parser.js";
import { TiiConnector } from "../../src/connectors/ie-tii/tii.connector.js";
import { loadSourceDefinition } from "../../src/infrastructure/filesystem/source-loader.js";
import { validateRegistry } from "../../src/validation/registry-validator.js";

describe("EV Roam parser", () => {
  it("parses the captured register fixture", async () => {
    const body = await readFile("tests/fixtures/gb-evroam/register-basic.json", "utf8");
    const result = parseEvroamRegister(body);

    expect(result.errors).toHaveLength(0);
    expect(result.records).toHaveLength(3);
    expect(result.records[0]).toMatchObject({
      title: "50FIVE CHARGING SOLUTIONS UK LTD",
      operatorId: "GB*505",
      serviceProviderId: "GB-505",
      operatorIdIE: "IE*505",
      serviceProviderIdIE: "IE-505",
    });
  });

  it("normalizes GB and IE CPO and EMSP identifiers", async () => {
    const source = await loadSourceDefinition("gb-evroam");
    const connector = new EvroamConnector();
    const result = await connector.normalize({
      source,
      retrievedAt: "2026-06-15T00:00:00.000Z",
      records: [
        {
          title: "50FIVE CHARGING SOLUTIONS UK LTD",
          operatorId: "GB*505",
          serviceProviderId: "GB-505",
          operatorIdIE: "IE*505",
          serviceProviderIdIE: "IE-505",
          website: "https://www.50five.com",
        },
        {
          title: "Arval UK Limited",
          serviceProviderId: "GB-AVL",
          website: "https://www.arval.co.uk",
        },
      ],
    });

    expect(result.warnings).toHaveLength(0);
    expect(result.records.map((record) => record.key)).toEqual([
      "gb-evroam:GB:505:CPO",
      "gb-evroam:GB:505:EMSP",
      "gb-evroam:IE:505:CPO",
      "gb-evroam:IE:505:EMSP",
      "gb-evroam:GB:AVL:EMSP",
    ]);
    expect(result.records.map((record) => record.source.official)).toEqual([
      true,
      true,
      false,
      false,
      true,
    ]);
    // Irish rows take the upstream status like GB rows; the official-status
    // policy downgrades them once TII, the Irish registrar, is in the build.
    expect(result.records.map((record) => record.status)).toEqual([
      "ACTIVE",
      "ACTIVE",
      "ACTIVE",
      "ACTIVE",
      "ACTIVE",
    ]);
    expect(result.records[0]?.source.observation).toEqual({
      kind: "ASSIGNMENT",
      observingJurisdiction: "GB",
    });
    expect(result.records[2]).toMatchObject({
      countryCode: "IE",
      source: {
        official: false,
        observation: { kind: "CROSS_REGISTER_LISTING", observingJurisdiction: "GB" },
      },
    });
    expect(result.records[0]).toMatchObject({
      countryCode: "GB",
      partyId: "505",
      eMobilityId: "GB505",
      role: "CPO",
      organization: {
        name: "50FIVE CHARGING SOLUTIONS UK LTD",
        website: "https://www.50five.com",
      },
    });
  });

  it("warns and skips malformed identifiers", async () => {
    const source = await loadSourceDefinition("gb-evroam");
    const connector = new EvroamConnector();
    const result = await connector.normalize({
      source,
      retrievedAt: "2026-06-15T00:00:00.000Z",
      records: [
        {
          title: "Malformed Limited",
          operatorId: "GB*TOO-LONG",
          website: "not a url",
        },
      ],
    });

    expect(result.records).toHaveLength(0);
    expect(result.warnings[0]?.code).toBe("EVROAM_MALFORMED_IDENTIFIER");
  });

  it("keeps overlapping Irish EV Roam and TII records as separate source records", async () => {
    const evroamSource = await loadSourceDefinition("gb-evroam");
    const tiiSource = await loadSourceDefinition("ie-tii");
    const evroam = await new EvroamConnector().normalize({
      source: evroamSource,
      retrievedAt: "2026-06-15T00:00:00.000Z",
      records: [
        {
          title: "Blink Charge UK Ltd",
          operatorIdIE: "IE*BLK",
          serviceProviderIdIE: "IE-BLK",
        },
      ],
    });
    const tii = await new TiiConnector().normalize({
      source: tiiSource,
      retrievedAt: "2026-06-15T00:00:00.000Z",
      records: [
        {
          legalEntityName: "Blink Charge Ireland Ltd",
          tradingName: "Blink Charging",
          idroIssuedPartyId: "IEBLK",
          ocpiPartyIds: [],
          isCpo: true,
          isEmsp: true,
        },
      ],
    });
    const records = [...tii.records, ...evroam.records];

    expect(records.map((record) => record.key)).toEqual([
      "ie-tii:IE:BLK:CPO",
      "ie-tii:IE:BLK:EMSP",
      "gb-evroam:IE:BLK:CPO",
      "gb-evroam:IE:BLK:EMSP",
    ]);
    expect(records.map((record) => record.source.registryId)).toEqual([
      "ie-tii",
      "ie-tii",
      "gb-evroam",
      "gb-evroam",
    ]);
    expect(records.map((record) => record.source.official)).toEqual([true, true, false, false]);
    const published = applyOfficialStatusPolicy(records);
    expect(published.map((record) => record.status)).toEqual([
      "ACTIVE",
      "ACTIVE",
      "UNKNOWN",
      "UNKNOWN",
    ]);
    expect(published[2]?.metadata.statusPolicy).toBe(
      "unknown-non-official-country-with-official-idro",
    );
    expect(validateRegistry(published, [tiiSource, evroamSource])).toHaveLength(0);
  });
});

describe("EV Roam foreign identifiers", () => {
  it("publishes a foreign identifier in a GB field as a listing observed in GB", async () => {
    const source = await loadSourceDefinition("gb-evroam");
    const result = await new EvroamConnector().normalize({
      source,
      retrievedAt: "2026-06-15T00:00:00.000Z",
      records: [{ title: "Example Operator", operatorId: "FR*ABC", website: null }],
    });

    expect(result.warnings).toEqual([]);
    expect(result.records[0]).toMatchObject({
      key: "gb-evroam:FR:ABC:CPO",
      source: {
        official: false,
        observation: { kind: "CROSS_REGISTER_LISTING", observingJurisdiction: "GB" },
      },
    });
  });
});
