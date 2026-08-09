import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { mergeInvalidRecordHistory } from "../../src/application/invalid-record-history.js";
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
      sampleRecord("ABC"),
      sampleRecord("WXYZ"),
      sampleRecord("XYZ"),
      sampleRecord("TUVW"),
    ];

    const { valid, invalid } = partitionRecordsByIdentifierValidity(records);

    expect(valid.map((record) => record.partyId)).toEqual(["ABC", "XYZ"]);
    expect(invalid.map((entry) => entry.record.partyId)).toEqual(["WXYZ", "TUVW"]);
    expect(invalid[0]?.reasons).toEqual(["INVALID_PARTY_ID"]);
  });

  it("is idempotent", () => {
    const records = [sampleRecord("ABC"), sampleRecord("WXYZ")];
    const once = partitionRecordsByIdentifierValidity(records);
    const twice = partitionRecordsByIdentifierValidity(once.valid);

    expect(twice.invalid).toEqual([]);
    expect(twice.valid).toEqual(once.valid);
  });

  it("reports an invalid party ID as a registry error", async () => {
    const source = await loadSourceDefinition("se-energimyndigheten");
    const issues = validateRegistry([sampleRecord("WXYZ")], [source]);

    expect(issues.some((issue) => issue.code === "INVALID_PARTY_ID")).toBe(true);
    expect(issues.find((issue) => issue.code === "INVALID_PARTY_ID")?.severity).toBe("error");
    expect(validateRegistry([sampleRecord("ABC")], [source])).toEqual([]);
  });

  it("writes the common invalid list and its counters instead of publishing the records", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "open-idro-invalid-"));
    const source = await loadSourceDefinition("se-energimyndigheten");
    try {
      await writeDatasets(
        [sampleRecord("ABC")],
        [source],
        [],
        "2026-06-14T00:00:00.000Z",
        outputDir,
        mergeInvalidRecordHistory(
          null,
          {
            records: partitionRecordsByIdentifierValidity([sampleRecord("WXYZ")]).invalid,
            rows: [],
            outOfJurisdiction: [],
          },
          "2026-06-14T00:00:00.000Z",
        ),
      );

      const invalid = JSON.parse(await readFile(join(outputDir, "registry-invalid.json"), "utf8"));
      expect(invalid).toEqual({
        generatedAt: "2026-06-14T00:00:00.000Z",
        records: [
          {
            reasons: ["INVALID_PARTY_ID"],
            firstDetectedAt: "2026-06-14T00:00:00.000Z",
            lastDetectedAt: "2026-06-14T00:00:00.000Z",
            supersededBy: null,
            record: sampleRecord("WXYZ"),
          },
        ],
        rows: [],
        outOfJurisdiction: [],
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
        await expect(readFile(join(outputDir, file), "utf8")).resolves.not.toContain("WXYZ");
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
        [sampleRecord("ABC")],
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
        outOfJurisdiction: [],
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
        message: "Unexpected identifier syntax: SEWXYZ",
        rejectedIdentifier: "SEWXYZ",
      },
    ]);

    expect(rows).toEqual([
      {
        registryId: "se-energimyndigheten",
        code: "ENERGIMYNDIGHETEN_MALFORMED_IDENTIFIER",
        sourceValue: "SEWXYZ",
        message: "Unexpected identifier syntax: SEWXYZ",
      },
    ]);
  });

  it("publishes rejected rows and counts them separately from invalid records", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "open-idro-rejected-"));
    const source = await loadSourceDefinition("se-energimyndigheten");
    try {
      await writeDatasets(
        [sampleRecord("ABC")],
        [source],
        [],
        "2026-06-14T00:00:00.000Z",
        outputDir,
        mergeInvalidRecordHistory(
          null,
          {
            records: [],
            rows: [
              {
                registryId: "se-energimyndigheten",
                code: "ENERGIMYNDIGHETEN_MALFORMED_IDENTIFIER",
                sourceValue: "SETUVW",
                message: "Unexpected identifier syntax: SETUVW",
              },
              {
                registryId: "se-energimyndigheten",
                code: "ENERGIMYNDIGHETEN_MALFORMED_IDENTIFIER",
                sourceValue: "SEWXYZ",
                message: "Unexpected identifier syntax: SEWXYZ",
              },
            ],
            outOfJurisdiction: [],
          },
          "2026-06-14T00:00:00.000Z",
        ),
      );

      const invalid = JSON.parse(await readFile(join(outputDir, "registry-invalid.json"), "utf8"));
      expect(invalid.records).toEqual([]);
      expect(invalid.rows.map((row: { sourceValue: string }) => row.sourceValue)).toEqual([
        "SETUVW",
        "SEWXYZ",
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

  it("keeps historical entries out of the counters", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "open-idro-history-"));
    const source = await loadSourceDefinition("se-energimyndigheten");
    try {
      const detection = {
        records: partitionRecordsByIdentifierValidity([sampleRecord("WXYZ")]).invalid,
        rows: [],
        outOfJurisdiction: [],
      };
      const previous = mergeInvalidRecordHistory(null, detection, "2026-06-14T00:00:00.000Z");
      // The source has stopped publishing it, so the next run detects nothing.
      const history = mergeInvalidRecordHistory(
        previous,
        { records: [], rows: [], outOfJurisdiction: [] },
        "2026-07-27T00:00:00.000Z",
      );

      await writeDatasets(
        [sampleRecord("ABC")],
        [source],
        [],
        "2026-07-27T00:00:00.000Z",
        outputDir,
        history,
      );

      const invalid = JSON.parse(await readFile(join(outputDir, "registry-invalid.json"), "utf8"));
      expect(invalid.records).toHaveLength(1);

      const stats = JSON.parse(await readFile(join(outputDir, "stats.json"), "utf8"));
      expect(stats).toMatchObject({
        totalInvalidRecords: 0,
        invalidRecordsByReason: {},
        invalidRecordsByRegistry: {},
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
        writeDatasets([sampleRecord("WXYZ")], [source], [], "2026-06-14T00:00:00.000Z", outputDir),
      ).rejects.toThrow("se-energimyndigheten:SE:WXYZ:CPO");
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
        "https://www.energimyndigheten.se/globalassets/klimat/laddinfrastruktur/register-av-identifieringsdata.xlsx",
      sourceValue: `SE${partyId}`,
      firstSeenAt: "2026-06-14T00:00:00.000Z",
      lastSeenAt: "2026-06-14T00:00:00.000Z",
      retrievedAt: "2026-06-14T00:00:00.000Z",
    },
    metadata: {},
  };
}
