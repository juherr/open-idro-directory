import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  DISCREPANCY_CATEGORIES,
  DISCREPANCY_CONFIDENCES,
  DISCREPANCY_SEVERITIES,
  type DiscrepancyCategory,
  type DiscrepancyFinding,
  type DiscrepancyReport,
} from "../../src/application/discrepancy-report.js";
import { discrepanciesSchema } from "../../src/application/discrepancy-report-schema.js";
import { fromRoot } from "../../src/infrastructure/filesystem/paths.js";

// No JSON Schema validator is a dependency; Zod's reader of a JSON Schema
// checks a payload against it.
const validator = z.fromJSONSchema(discrepanciesSchema as never);

function finding(category: DiscrepancyCategory): DiscrepancyFinding {
  return {
    category,
    severity: "info",
    confidence: "high",
    countryCode: category === "DUPLICATE_IDENTIFIER" ? null : "DK",
    issuingRegistryId: category === "OUTSIDE_ISSUING_REGISTER_SCOPE" ? null : "dk-fstyr",
    observedRegistryId: "se-energimyndigheten",
    identifier: category.startsWith("SOURCE_")
      ? null
      : { countryCode: "DK", partyId: "MON", role: "CPO", eMobilityId: "DKMON" },
    issuingConfirmation: category === "NOT_FOUND_IN_ISSUING_REGISTER" ? "NOT_FOUND" : null,
    ...(category === "ISSUING_REGISTER_UNVERIFIABLE" ? { reason: "SOURCE_UNAVAILABLE" } : {}),
    summary: `DK*MON: ${category}`,
    evidence: [
      {
        recordKey: category.startsWith("SOURCE_") ? null : "se-energimyndigheten:DK:MON:CPO",
        registryId: "se-energimyndigheten",
        retrievedAt: "2026-06-15T00:00:00.000Z",
        lastSeenAt: null,
        healthState: "CURRENT",
        recordCount: 3,
      },
    ],
  };
}

function report(): DiscrepancyReport {
  const findings = DISCREPANCY_CATEGORIES.map(finding);
  return {
    generatedAt: "2026-06-15T00:00:00.000Z",
    summary: {
      totalFindings: findings.length,
      byCategory: Object.fromEntries(DISCREPANCY_CATEGORIES.map((key) => [key, 1])) as never,
      bySeverity: { high: 0, medium: 0, low: 0, info: findings.length },
    },
    countries: [
      {
        countryCode: "DK",
        issuingRegistryIds: ["dk-fstyr"],
        pairs: [
          { issuingRegistryId: "dk-fstyr", observedRegistryId: "se-energimyndigheten", findings },
        ],
      },
      { countryCode: null, issuingRegistryIds: [], pairs: [] },
    ],
  };
}

describe("discrepancies JSON schema", () => {
  it("accepts a report holding a finding of every category", () => {
    expect(validator.safeParse(report()).error).toBeUndefined();
  });

  it.each([
    ["an unknown category", { category: "INVALID_IDENTIFIER" }],
    ["an unknown severity", { severity: "error" }],
    ["an unknown confidence", { confidence: "certain" }],
    ["a finding without evidence", { evidence: undefined }],
  ])("refuses a finding with %s", (_case, override) => {
    const payload = report();
    const pair = payload.countries[0]!.pairs[0]!;
    pair.findings[0] = { ...pair.findings[0]!, ...override } as DiscrepancyFinding;

    expect(validator.safeParse(payload).success).toBe(false);
  });

  it("lists exactly the categories, severities and confidences the report uses", () => {
    const item = discrepanciesSchema.$defs.finding.properties;

    expect(item.category.enum).toEqual(DISCREPANCY_CATEGORIES);
    expect(item.severity.enum).toEqual(DISCREPANCY_SEVERITIES);
    expect(item.confidence.enum).toEqual(DISCREPANCY_CONFIDENCES);
  });

  it("is the schema published under schemas/", async () => {
    const published = JSON.parse(
      await readFile(fromRoot("schemas", "discrepancies.schema.json"), "utf8"),
    ) as unknown;

    expect(published).toEqual(discrepanciesSchema);
  });

  it("accepts the example of the data model documentation", async () => {
    const doc = await readFile(fromRoot("docs", "data-model.md"), "utf8");
    const section = doc.slice(doc.indexOf("## Discrepancy Report"));
    const example = /```json\n([\s\S]*?)\n```/.exec(section)?.[1];
    expect(example).toBeDefined();
    const payload = JSON.parse(example ?? "") as DiscrepancyReport;

    expect(validator.safeParse(payload).error).toBeUndefined();
    expect(Object.keys(payload.summary.byCategory)).toEqual(DISCREPANCY_CATEGORIES);
    expect(Object.keys(payload.summary.bySeverity)).toEqual(DISCREPANCY_SEVERITIES);
  });
});
