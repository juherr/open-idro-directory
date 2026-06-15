import { describe, expect, it } from "vitest";
import { loadSourceDefinition } from "../../src/infrastructure/filesystem/source-loader.js";
import { ElectrokinisiConnector } from "../../src/connectors/gr-electrokinisi/electrokinisi.connector.js";
import { parseElectrokinisiHtml } from "../../src/connectors/gr-electrokinisi/electrokinisi.parser.js";

const FIXTURE = `
<table class="u-table-entity">
  <thead><tr><th>Company Name</th><th>Assigned ID</th></tr></thead>
  <tbody>
    <tr>
      <td></td>
      <td>ΔΕΗ blue</td>
      <td>
        <span class="text-bold text-blue">GR * PPC </span><span class="text-sm">Φ.Ε.Υ.Φ.Η.Ο.</span><br />
        <span class="text-bold text-blue">GR * DEI </span><span class="text-sm">Π.Υ.Η.</span><br />
        <span class="text-bold text-blue">GR * DBL </span><span class="text-sm">Φ.Δ.Σ.</span><br />
      </td>
      <td><a href="//www.deiblue.com">www.deiblue.com</a></td>
      <td><a href="mailto:Info.Deiblue@dei.gr">Info.Deiblue@dei.gr</a></td>
    </tr>
  </tbody>
</table>`;

describe("parseElectrokinisiHtml", () => {
  it("extracts Greek IDRO table identifiers", () => {
    const result = parseElectrokinisiHtml(FIXTURE);

    expect(result.errors).toEqual([]);
    expect(result.records).toEqual([
      {
        organizationName: "ΔΕΗ blue",
        sourceValue: "GR * PPC",
        sourceRole: "Φ.Ε.Υ.Φ.Η.Ο.",
        role: "CPO",
        website: "https://www.deiblue.com/",
        email: "Info.Deiblue@dei.gr",
      },
      {
        organizationName: "ΔΕΗ blue",
        sourceValue: "GR * DEI",
        sourceRole: "Π.Υ.Η.",
        role: "EMSP",
        website: "https://www.deiblue.com/",
        email: "Info.Deiblue@dei.gr",
      },
      {
        organizationName: "ΔΕΗ blue",
        sourceValue: "GR * DBL",
        sourceRole: "Φ.Δ.Σ.",
        role: "OTHER",
        website: "https://www.deiblue.com/",
        email: "Info.Deiblue@dei.gr",
      },
    ]);
  });
});

describe("ElectrokinisiConnector", () => {
  it("normalizes CPO and EMSP identifiers and skips other roles", async () => {
    const source = await loadSourceDefinition("gr-electrokinisi");
    const parsed = parseElectrokinisiHtml(FIXTURE);
    const result = await new ElectrokinisiConnector().normalize({
      source,
      records: parsed.records,
      retrievedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(result.warnings).toEqual([]);
    expect(result.records.map((record) => `${record.eMobilityId}:${record.role}`)).toEqual([
      "GRPPC:CPO",
      "GRDEI:EMSP",
    ]);
    expect(result.records[0]?.organization.website).toBe("https://www.deiblue.com/");
  });
});
