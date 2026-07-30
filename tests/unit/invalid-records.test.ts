import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import type { NormalizedRegistryRecord } from "../../src/domain/registry-record.js";
import { loadSourceDefinition } from "../../src/infrastructure/filesystem/source-loader.js";
import { writeDatasets } from "../../src/infrastructure/serialization/serializers.js";
import {
  partitionRecordsByIdentifierValidity,
  toRejectedSourceRows,
} from "../../src/validation/identifier-validator.js";
import { validateRegistry } from "../../src/validation/registry-validator.js";

describe("invalid identifier handling", () => {
  it("splits records on eMI3 validity and preserves order", () => {
    const records = [
      sampleRecord("AIM"),
      sampleRecord("ALEG"),
      sampleRecord("ESP"),
      sampleRecord("T124"),
    ];

    const { valid, invalid } = partitionRecordsByIdentifierValidity(records);

    expect(valid.map((record) => record.partyId)).toEqual(["AIM", "ESP"]);
    expect(invalid.map((entry) => entry.record.partyId)).toEqual(["ALEG", "T124"]);
    expect(invalid[0]?.reasons).toEqual(["INVALID_PARTY_ID"]);
  });

  it("is idempotent", () => {
    const records = [sampleRecord("AIM"), sampleRecord("ALEG")];
    const once = partitionRecordsByIdentifierValidity(records);
    const twice = partitionRecordsByIdentifierValidity(once.valid);

    expect(twice.invalid).toEqual([]);
    expect(twice.valid).toEqual(once.valid);
  });

  it("reports an invalid party ID as a registry error", async () => {
    const source = await loadSourceDefinition("se-energimyndigheten");
    const issues = validateRegistry([sampleRecord("ALEG")], [source]);

    expect(issues.some((issue) => issue.code === "INVALID_PARTY_ID")).toBe(true);
    expect(issues.find((issue) => issue.code === "INVALID_PARTY_ID")?.severity).toBe("error");
    expect(validateRegistry([sampleRecord("AIM")], [source])).toEqual([]);
  });

  it("writes the common invalid list and its counters instead of publishing the records", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "open-idro-invalid-"));
    const source = await loadSourceDefinition("se-energimyndigheten");
    try {
      await writeDatasets(
        [sampleRecord("AIM")],
        [source],
        [],
        "2026-06-14T00:00:00.000Z",
        outputDir,
        partitionRecordsByIdentifierValidity([sampleRecord("ALEG")]).invalid,
      );

      const invalid = JSON.parse(await readFile(join(outputDir, "registry-invalid.json"), "utf8"));
      expect(invalid).toEqual({
        generatedAt: "2026-06-14T00:00:00.000Z",
        records: [{ reasons: ["INVALID_PARTY_ID"], record: sampleRecord("ALEG") }],
        rows: [],
      });

      const stats = JSON.parse(await readFile(join(outputDir, "stats.json"), "utf8"));
      expect(stats).toMatchObject({
        totalRecords: 1,
        totalInvalidRecords: 1,
        totalRejectedRows: 0,
        invalidRecordsByReason: { INVALID_PARTY_ID: 1 },
        invalidRecordsByRegistry: { "se-energimyndigheten": 1 },
        rejectedRowsByRegistry: {},
      });

      for (const file of [
        "registry.json",
        "registry.min.json",
        "registry.ndjson",
        "registry.csv",
      ]) {
        await expect(readFile(join(outputDir, file), "utf8")).resolves.not.toContain("ALEG");
      }
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  });

  it("still writes an empty invalid list when every record is valid", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "open-idro-invalid-empty-"));
    const source = await loadSourceDefinition("se-energimyndigheten");
    try {
      await writeDatasets(
        [sampleRecord("AIM")],
        [source],
        [],
        "2026-06-14T00:00:00.000Z",
        outputDir,
      );

      const invalid = JSON.parse(await readFile(join(outputDir, "registry-invalid.json"), "utf8"));
      expect(invalid).toEqual({
        generatedAt: "2026-06-14T00:00:00.000Z",
        records: [],
        rows: [],
      });
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  });

  it("collects rows the connectors could not parse into an identifier", () => {
    const rows = toRejectedSourceRows("se-energimyndigheten", [
      {
        severity: "warning",
        sourceId: "se-energimyndigheten",
        code: "ENERGIMYNDIGHETEN_DUPLICATE_IDENTIFIER",
        message: "Duplicate identifier.",
      },
      {
        severity: "warning",
        sourceId: "se-energimyndigheten",
        code: "ENERGIMYNDIGHETEN_MALFORMED_IDENTIFIER",
        message: "Unexpected Swedish Energy Agency identifier syntax: SEALLE",
        rejectedIdentifier: "SEALLE",
      },
    ]);

    expect(rows).toEqual([
      {
        registryId: "se-energimyndigheten",
        code: "ENERGIMYNDIGHETEN_MALFORMED_IDENTIFIER",
        sourceValue: "SEALLE",
        message: "Unexpected Swedish Energy Agency identifier syntax: SEALLE",
      },
    ]);
  });

  it("publishes rejected rows and counts them separately from invalid records", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "open-idro-rejected-"));
    const source = await loadSourceDefinition("se-energimyndigheten");
    try {
      await writeDatasets(
        [sampleRecord("AIM")],
        [source],
        [],
        "2026-06-14T00:00:00.000Z",
        outputDir,
        [],
        [
          {
            registryId: "se-energimyndigheten",
            code: "ENERGIMYNDIGHETEN_MALFORMED_IDENTIFIER",
            sourceValue: "SEQWCE",
            message: "Unexpected Swedish Energy Agency identifier syntax: SEQWCE",
          },
          {
            registryId: "se-energimyndigheten",
            code: "ENERGIMYNDIGHETEN_MALFORMED_IDENTIFIER",
            sourceValue: "SEALLE",
            message: "Unexpected Swedish Energy Agency identifier syntax: SEALLE",
          },
        ],
      );

      const invalid = JSON.parse(await readFile(join(outputDir, "registry-invalid.json"), "utf8"));
      expect(invalid.records).toEqual([]);
      expect(invalid.rows.map((row: { sourceValue: string }) => row.sourceValue)).toEqual([
        "SEALLE",
        "SEQWCE",
      ]);

      const stats = JSON.parse(await readFile(join(outputDir, "stats.json"), "utf8"));
      expect(stats).toMatchObject({
        totalInvalidRecords: 0,
        totalRejectedRows: 2,
        rejectedRowsByRegistry: { "se-energimyndigheten": 2 },
      });
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  });

  it("refuses to publish an invalid record", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "open-idro-invalid-guard-"));
    const source = await loadSourceDefinition("se-energimyndigheten");
    try {
      await expect(
        writeDatasets([sampleRecord("ALEG")], [source], [], "2026-06-14T00:00:00.000Z", outputDir),
      ).rejects.toThrow("se-energimyndigheten:SE:ALEG:CPO");
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  });
});

function sampleRecord(partyId: string): NormalizedRegistryRecord {
  return {
    key: `se-energimyndigheten:SE:${partyId}:CPO`,
    countryCode: "SE",
    partyId,
    eMobilityId: `SE${partyId}`,
    role: "CPO",
    status: "ACTIVE",
    organization: { name: "Example", legalName: null, website: null },
    source: {
      registryId: "se-energimyndigheten",
      official: true,
      sourceRecordId: `SE${partyId}`,
      sourceUrl:
        "https://www.energimyndigheten.se/4ac461/globalassets/klimat/laddinfrastruktur/register-av-identifieringsdata.xlsx",
      sourceValue: `SE${partyId}`,
      firstSeenAt: "2026-06-14T00:00:00.000Z",
      lastSeenAt: "2026-06-14T00:00:00.000Z",
      retrievedAt: "2026-06-14T00:00:00.000Z",
    },
    metadata: {},
  };
}
