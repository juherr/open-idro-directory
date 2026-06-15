import { describe, expect, it } from "vitest";
import { HuIdroConnector } from "../../src/connectors/hu-idro/hu-idro.connector.js";
import { parseHuIdroHtml } from "../../src/connectors/hu-idro/hu-idro.parser.js";
import { loadSourceDefinition } from "../../src/infrastructure/filesystem/source-loader.js";

const FIXTURE = `
<span><span style="font-size:16px;"><span style="font-weight:bold;">Members and ID list</span></span>
  <ul>
    <li class="my-3">
      <b>Demo Mobility Kft.</b><br />
      Adószám: 12345678-2-42
      <div class="d-block">
        ID lista:
        <ul><li>HU*CPO</li><li>HU-EMS-</li></ul>
      </div>
    </li>
  </ul>
</span>`;

describe("parseHuIdroHtml", () => {
  it("extracts Hungarian member identifiers", () => {
    const result = parseHuIdroHtml(FIXTURE);

    expect(result.errors).toEqual([]);
    expect(result.records).toEqual([
      {
        organizationName: "Demo Mobility Kft.",
        taxNumber: "12345678-2-42",
        sourceValue: "HU*CPO",
        role: "CPO",
      },
      {
        organizationName: "Demo Mobility Kft.",
        taxNumber: "12345678-2-42",
        sourceValue: "HU-EMS-",
        role: "EMSP",
      },
    ]);
  });
});

describe("HuIdroConnector", () => {
  it("normalizes complete identifiers including trailing separators", async () => {
    const source = await loadSourceDefinition("hu-idro");
    const parsed = parseHuIdroHtml(FIXTURE);
    const result = await new HuIdroConnector().normalize({
      source,
      records: parsed.records,
      retrievedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(result.records.map((record) => `${record.eMobilityId}:${record.role}`)).toEqual([
      "HUCPO:CPO",
      "HUEMS:EMSP",
    ]);
    expect(result.warnings).toEqual([]);
  });
});
