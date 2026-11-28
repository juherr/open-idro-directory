import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { buildRegistry, type BuildOptions } from "../../src/application/build-registry.js";
import { EvroamConnector } from "../../src/connectors/gb-evroam/evroam.connector.js";
import type { RegistryConnector } from "../../src/connectors/connector.js";
import { EnergimyndighetenConnector } from "../../src/connectors/se-energimyndigheten/energimyndigheten.connector.js";
import type {
  NormalizedRegistryRecord,
  RegistryObservation,
} from "../../src/domain/registry-record.js";
import type { SourceDefinition } from "../../src/domain/source-definition.js";
import type { ValidationIssue } from "../../src/domain/validation-issue.js";
import { diffRecords } from "../../src/application/change-report.js";
import type { DiscrepancyReport } from "../../src/application/discrepancy-report.js";
import { identifierRoleKey } from "../../src/domain/identifier-provenance.js";
import { withPublishedObservations } from "../../src/domain/registry-observation.js";
import { loadSourceDefinition } from "../../src/infrastructure/filesystem/source-loader.js";
import type { PublishedSourceHealth } from "../../src/infrastructure/serialization/serializers.js";
import { validateRegistry } from "../../src/validation/registry-validator.js";

describe("buildRegistry", () => {
  it("keeps the records of the sources a filtered run did not rebuild", async () => {
    await withWorkspace(async ({ build, outputDir }) => {
      const result = await build({ sourceId: "fr-afirev" });

      expect(result.records.map((record) => record.key).toSorted()).toEqual([
        "dk-fstyr:DK:BBB:CPO",
        "fr-afirev:FR:AAA:CPO",
      ]);
      const published = JSON.parse(
        await readFile(join(outputDir, "registry.json"), "utf8"),
      ) as NormalizedRegistryRecord[];
      expect(published.filter((record) => record.source.registryId === "dk-fstyr")).toHaveLength(1);
    });
  });

  it("keeps the health of the sources a filtered run did not rebuild", async () => {
    await withWorkspace(async ({ build, outputDir }) => {
      await build({ sourceId: "fr-afirev" });

      expect(await readHealth(outputDir, "dk-fstyr")).toMatchObject({
        recordCount: 1,
        lastSuccessfulRetrieval: PREVIOUS_RETRIEVAL,
        checksum: "previous-checksum",
        freshness: "current",
      });
    });
  });

  it("drops the records of a source that is no longer published", async () => {
    await withWorkspace(async ({ build, outputDir, sources }) => {
      // Disabling a source is how an operator removes it from the datasets, so
      // carrying unrebuilt sources must not resurrect it.
      const result = await build({
        sourceId: "fr-afirev",
        sources: sources.map((source) =>
          source.id === "dk-fstyr"
            ? { ...source, publication: { ...source.publication, enabled: false } }
            : source,
        ),
      });

      expect(result.records.map((record) => record.key)).toEqual(["fr-afirev:FR:AAA:CPO"]);
      expect(await readHealth(outputDir, "dk-fstyr")).toMatchObject({
        recordCount: 0,
        freshness: "disabled",
      });
    });
  });

  it("refuses a filter that matches no enabled source", async () => {
    await withWorkspace(async ({ build }) => {
      // Otherwise the run rebuilds nothing, republishes everything, and reports
      // success, which reads as "the source was updated".
      await expect(build({ sourceId: "ch-typo" })).rejects.toThrow(
        /no enabled source matches ch-typo/i,
      );
    });
  });

  it("republishes a source that could not be fetched and reports it as stale", async () => {
    await withWorkspace(async ({ build, outputDir }) => {
      const result = await build({
        fetchErrors: { "dk-fstyr": "HTTP 404 while fetching https://example.test/" },
      });

      const failed = result.results.find((entry) => entry.sourceId === "dk-fstyr");
      expect(failed?.errors[0]?.code).toBe("SOURCE_FETCH_FAILED");
      expect(failed?.records.map((record) => record.key)).toEqual(["dk-fstyr:DK:BBB:CPO"]);
      expect(await readHealth(outputDir, "dk-fstyr")).toMatchObject({
        stale: true,
        freshness: "stale",
        latestErrorSummary: "HTTP 404 while fetching https://example.test/",
        // The operator needs to know when the source last answered, so a failed
        // run must not erase the previous success.
        lastSuccessfulRetrieval: PREVIOUS_RETRIEVAL,
      });
    });
  });

  // #91 reference scenario 6: the issuing register being unreachable says
  // nothing about the identifiers another register lists.
  it("keeps a cross-register listing when the issuing source failed", async () => {
    const evroam = await loadSourceDefinition("gb-evroam");
    const listing = await new EvroamConnector().normalize({
      source: evroam,
      retrievedAt: GENERATED_AT,
      records: [{ title: "Blink Charge UK Ltd", operatorIdIE: "IE*BLK" }],
    });
    const official = sampleRecord("ie-tii", "IE", "BLK");
    await withWorkspace(
      async ({ build, outputDir }) => {
        const result = await build({
          createConnector: connectorReturning(listing.records),
          fetchErrors: { "ie-tii": "HTTP 503 while fetching https://example.test/" },
        });

        expect(result.records.map((record) => record.key).toSorted()).toEqual([
          "gb-evroam:IE:BLK:CPO",
          "ie-tii:IE:BLK:CPO",
        ]);
        const observed = result.records.find((record) => record.key === "gb-evroam:IE:BLK:CPO");
        expect(observed?.source).toMatchObject({
          official: false,
          observation: { kind: "CROSS_REGISTER_LISTING", observingJurisdiction: "GB" },
        });
        expect(await readHealth(outputDir, "ie-tii")).toMatchObject({ freshness: "stale" });
      },
      { sourceIds: ["ie-tii", "gb-evroam"], published: [official] },
    );
  });

  // Issue #91, scenarios 4 and 5: absence from the issuing register is not
  // invalidity, and the issuing register is left as it is.
  it("publishes a PL identifier another register lists while the Polish register does not", async () => {
    const sweden = await loadSourceDefinition("se-energimyndigheten");
    const swedishRecords = await new EnergimyndighetenConnector().normalize({
      source: sweden,
      retrievedAt: GENERATED_AT,
      records: [
        {
          sourceValue: "PL*ABC",
          organizationName: "Example Polska",
          role: "CPO",
          sourceUrl: "https://example.test/",
        },
      ],
    });
    const polish = withObservationBlock(sampleRecord("pl-eipa", "PL", "XYZ"), {
      kind: "ASSIGNMENT",
      observingJurisdiction: "PL",
    });
    const connectors: Record<string, NormalizedRegistryRecord[]> = {
      "pl-eipa": [polish],
      "se-energimyndigheten": swedishRecords.records,
    };
    await withWorkspace(
      async ({ build, outputDir, sources }) => {
        const result = await build({
          createConnector: (source) => connectorReturning(connectors[source.id] ?? [])(),
        });

        const listing = result.records.find(
          (record) => record.key === "se-energimyndigheten:PL:ABC:CPO",
        );
        expect(listing?.source).toMatchObject({
          official: false,
          observation: { kind: "CROSS_REGISTER_LISTING", observingJurisdiction: "SE" },
        });
        expect(
          result.records
            .filter((record) => record.source.registryId === "pl-eipa")
            .map((record) => record.key),
        ).toEqual(["pl-eipa:PL:XYZ:CPO"]);
        // Only the retrieval time of this run and the derived issuing block
        // differ from what pl-eipa published.
        expect(result.records.find((record) => record.key === polish.key)).toEqual({
          ...polish,
          source: { ...polish.source, retrievedAt: GENERATED_AT },
          issuing: expect.objectContaining({ country: "PL" }),
        });
        expect(validateRegistry(result.records, sources)).toEqual([]);
        const invalid = JSON.parse(
          await readFile(join(outputDir, "registry-invalid.json"), "utf8"),
        ) as { records: unknown[]; rows: unknown[]; outOfJurisdiction: unknown[] };
        expect(invalid).toMatchObject({ records: [], rows: [], outOfJurisdiction: [] });
      },
      { sourceIds: ["pl-eipa", "se-energimyndigheten"], published: [polish] },
    );
  });

  // Records published before the observation block existed carry none: the
  // first rebuild that adds it must not read as every record having changed.
  it("does not count the observation block a published record lacks as a change", async () => {
    const current = withObservationBlock(sampleRecord("fr-afirev", "FR", "AAA"), {
      kind: "ASSIGNMENT",
      observingJurisdiction: "FR",
    });
    await withWorkspace(async ({ build }) => {
      const result = await build({
        sourceId: "fr-afirev",
        createConnector: connectorReturning([current]),
      });

      const afirev = result.results.find((entry) => entry.sourceId === "fr-afirev");
      expect(afirev?.errors).toEqual([]);
      expect(result.records.find((record) => record.key === current.key)?.source).toMatchObject({
        observation: { kind: "ASSIGNMENT", observingJurisdiction: "FR" },
      });
    });
  });

  it("throws when every selected source failed", async () => {
    await withWorkspace(async ({ build }) => {
      await expect(
        build({
          fetchErrors: {
            "fr-afirev": "HTTP 500 while fetching https://example.test/",
            "dk-fstyr": "HTTP 404 while fetching https://example.test/",
          },
        }),
      ).rejects.toThrow(/every selected source failed/i);
    });
  });
});

describe("buildRegistry issuing confirmation", () => {
  const NORDIC = ["dk-fstyr", "se-energimyndigheten"];

  // dk-fstyr assigns DK*BBB; the Swedish register lists DK*BBB and DK*MON
  // besides its own. The status policy marks published foreign listings
  // UNKNOWN, which a rebuild compares with the connector's ACTIVE: the Swedish
  // assignments keep that below the mass-change threshold, as upstream.
  async function nordicConnectors(dkErrors: ValidationIssue[] = []) {
    const swedish = await swedishListings("SE*AAA", "SE*BBB", "SE*CCC", "DK*BBB", "DK*MON");
    const connectors: Record<string, () => RegistryConnector> = {
      "dk-fstyr": connectorReturning([assignedThisRun("dk-fstyr", "DK", "BBB")], dkErrors),
      "se-energimyndigheten": connectorReturning(swedish),
    };
    return (source: SourceDefinition) => connectors[source.id]!();
  }

  it("gives every record of an identifier and role the same issuing block", async () => {
    const createConnector = await nordicConnectors();
    await withWorkspace(
      async ({ build }) => {
        const { records } = await build({ createConnector });

        expect(records.every((record) => record.issuing !== undefined)).toBe(true);
        for (const group of Map.groupBy(records, identifierRoleKey).values()) {
          expect(new Set(group.map((record) => JSON.stringify(record.issuing))).size).toBe(1);
        }
        expect(records.filter((record) => identifierRoleKey(record) === "DK:BBB:CPO")).toHaveLength(
          2,
        );
        expect(issuingOf(records, "DK:BBB:CPO")).toEqual({
          country: "DK",
          confirmation: "CONFIRMED",
          confirmedBy: ["dk-fstyr"],
        });
        expect(issuingOf(records, "DK:MON:CPO")).toEqual({
          country: "DK",
          confirmation: "NOT_FOUND",
          confirmedBy: [],
        });
      },
      { sourceIds: NORDIC, published: [] },
    );
  });

  // Plan decision 3d: a partial update reads the health of the sources it did
  // not rebuild from the published sources.json, and classifies every record,
  // carried ones included: dk-fstyr's published DK*BBB keeps confirming it,
  // even when dk-fstyr failed and its records were republished.
  it.each([
    { case: "current", fetchErrors: {}, dkErrors: [], expected: "NOT_FOUND" },
    {
      case: "unreachable",
      fetchErrors: { "dk-fstyr": "HTTP 503 while fetching https://example.test/" },
      dkErrors: [],
      expected: "SOURCE_UNAVAILABLE",
    },
    {
      case: "answering but not ingested",
      fetchErrors: {},
      dkErrors: [{ severity: "error" as const, code: "MASS_CHANGE", message: "1 of 1 changed." }],
      expected: "SOURCE_STALE",
    },
  ])(
    "classifies a Swedish-only update as the full build, carried confirmations included, with DK*MON $expected when dk-fstyr was $case",
    async ({ fetchErrors, dkErrors, expected }) => {
      const createConnector = await nordicConnectors(dkErrors);
      await withWorkspace(
        async ({ build, publishOutput }) => {
          const full = await build({ createConnector, fetchErrors });
          await publishOutput();
          const partial = await build({ createConnector, sourceId: "se-energimyndigheten" });

          expect(issuingOf(full.records, "DK:MON:CPO")?.confirmation).toBe(expected);
          expect(issuingOf(full.records, "DK:BBB:CPO")).toEqual({
            country: "DK",
            confirmation: "CONFIRMED",
            confirmedBy: ["dk-fstyr"],
          });
          expect(issuingByIdentifier(partial.records)).toEqual(issuingByIdentifier(full.records));
        },
        { sourceIds: NORDIC, published: [sampleRecord("dk-fstyr", "DK", "BBB")] },
      );
    },
  );

  // A carried source published without health falls back to `stale: false`:
  // it must not read as a current register that does not list the identifier.
  it("reads a carried issuing source without published health as unavailable", async () => {
    const createConnector = await nordicConnectors();
    await withWorkspace(
      async ({ build }) => {
        const { records } = await build({ createConnector, sourceId: "se-energimyndigheten" });

        expect(issuingOf(records, "DK:MON:CPO")?.confirmation).toBe("SOURCE_UNAVAILABLE");
      },
      { sourceIds: NORDIC, published: [], health: { "dk-fstyr": null } },
    );
  });

  it("does not count the issuing block as a change when rebuilding the same snapshots", async () => {
    const createConnector = await nordicConnectors();
    await withWorkspace(
      async ({ build, publishOutput, sources }) => {
        const first = await build({ createConnector });
        await publishOutput();
        const second = await build({ createConnector });

        expect(first.records.every((record) => record.issuing !== undefined)).toBe(true);
        expect(second.results.flatMap((result) => result.errors)).toEqual([]);
        expect(diffRecords(first.records, second.records)).toMatchObject({ updated: [] });
        // Committed datasets predate the block: deriving it is not an update.
        const blockless = first.records.map(({ issuing: _issuing, ...record }) => record);
        expect(
          diffRecords(withPublishedObservations(blockless, sources), second.records),
        ).toMatchObject({ updated: [] });
      },
      { sourceIds: NORDIC, published: [] },
    );
  });

  it("does not trip the safety thresholds over published records carrying issuing blocks", async () => {
    const published = {
      ...sampleRecord("fr-afirev", "FR", "AAA"),
      issuing: { country: "FR", confirmation: "NOT_FOUND" as const, confirmedBy: [] },
    };
    await withWorkspace(
      async ({ build }) => {
        const result = await build({ sourceId: "fr-afirev" });

        expect(result.results.find((entry) => entry.sourceId === "fr-afirev")?.errors).toEqual([]);
      },
      { published: [published, sampleRecord("dk-fstyr", "DK", "BBB")] },
    );
  });
});

describe("buildRegistry discrepancy report", () => {
  const NORDIC = ["dk-fstyr", "se-energimyndigheten"];
  const LATER = "2026-06-16T00:00:00.000Z";

  const duplicateWarning = (code: string, value: string): ValidationIssue => ({
    severity: "warning",
    code,
    message: `Duplicate identifier ${value} for CPO.`,
  });

  // dk-fstyr assigns DK*BBB; the Swedish register also lists DK*BBB and DK*MON.
  async function nordicConnectors(warnings: { dk?: ValidationIssue[]; se?: ValidationIssue[] }) {
    const swedish = await swedishListings("SE*AAA", "SE*BBB", "SE*CCC", "DK*BBB", "DK*MON");
    const connectors: Record<string, () => RegistryConnector> = {
      "dk-fstyr": connectorReturning([assignedThisRun("dk-fstyr", "DK", "BBB")], [], warnings.dk),
      "se-energimyndigheten": connectorReturning(swedish, [], warnings.se),
    };
    return (source: SourceDefinition) => connectors[source.id]!();
  }

  const duplicatesOf = (report: DiscrepancyReport) =>
    findingsOf(report)
      .filter((finding) => finding.category === "DUPLICATE_IDENTIFIER")
      .map((finding) => [finding.observedRegistryId, finding.evidence[0]?.code]);

  it.each([{ case: "a full build" }, { case: "a single-source build", sourceId: "fr-afirev" }])(
    "writes the report on $case",
    async ({ sourceId }) => {
      await withWorkspace(async ({ build, outputDir }) => {
        // Each register answers with its own identifier, so a full build passes
        // registry validation.
        const own: Record<string, NormalizedRegistryRecord> = {
          "fr-afirev": assignedThisRun("fr-afirev", "FR", "AAA"),
          "dk-fstyr": assignedThisRun("dk-fstyr", "DK", "BBB"),
        };
        await build({
          ...(sourceId ? { sourceId } : {}),
          createConnector: (source) => connectorReturning([own[source.id]!])(),
        });

        const report = await readDiscrepancies(outputDir);
        expect(report.generatedAt).toBe(GENERATED_AT);
        expect(report.summary.totalFindings).toBe(findingsOf(report).length);
      });
    },
  );

  it("gives a partial build the report of a full build", async () => {
    const createConnector = await nordicConnectors({
      dk: [duplicateWarning("FSTYR_DUPLICATE_IDENTIFIER", "DK*BBB")],
      se: [duplicateWarning("ENERGIMYNDIGHETEN_DUPLICATE_IDENTIFIER", "SE*AAA")],
    });
    await withWorkspace(
      async ({ build, outputDir, publishOutput }) => {
        await build({ createConnector });
        const full = await readDiscrepancies(outputDir);
        await publishOutput();
        await build({ createConnector, sourceId: "se-energimyndigheten", generatedAt: LATER });
        const partial = await readDiscrepancies(outputDir);

        expect(findingsOf(full).map((finding) => finding.category)).toContain(
          "NOT_FOUND_IN_ISSUING_REGISTER",
        );
        expect(duplicatesOf(full)).toEqual([
          ["dk-fstyr", "FSTYR_DUPLICATE_IDENTIFIER"],
          ["se-energimyndigheten", "ENERGIMYNDIGHETEN_DUPLICATE_IDENTIFIER"],
        ]);
        expect(partial.generatedAt).toBe(LATER);
        expect({ ...partial, generatedAt: GENERATED_AT }).toEqual(full);
      },
      { sourceIds: NORDIC, published: [] },
    );
  });

  it("keeps the duplicate findings of a source that failed, not of one rebuilt", async () => {
    const warned = await nordicConnectors({
      dk: [duplicateWarning("FSTYR_DUPLICATE_IDENTIFIER", "DK*BBB")],
      se: [duplicateWarning("ENERGIMYNDIGHETEN_DUPLICATE_IDENTIFIER", "SE*AAA")],
    });
    await withWorkspace(
      async ({ build, outputDir, publishOutput }) => {
        await build({ createConnector: warned });
        await publishOutput();
        await build({
          createConnector: await nordicConnectors({}),
          fetchErrors: { "dk-fstyr": "HTTP 503 while fetching https://example.test/" },
        });

        expect(duplicatesOf(await readDiscrepancies(outputDir))).toEqual([
          ["dk-fstyr", "FSTYR_DUPLICATE_IDENTIFIER"],
        ]);
      },
      { sourceIds: NORDIC, published: [] },
    );
  });

  // #31 reference scenario 4: an unreachable issuing register must not yield a
  // removal or a not-found.
  it("reports a failing issuing register as unverifiable only", async () => {
    const removed: NormalizedRegistryRecord = {
      ...sampleRecord("dk-fstyr", "DK", "OLD"),
      status: "INACTIVE",
      metadata: {
        inactiveSince: PREVIOUS_RETRIEVAL,
        inactiveReason: "missing-from-official-source",
      },
    };
    removed.source = { ...removed.source, lastSeenAt: "2026-06-01T00:00:00.000Z" };
    await withWorkspace(
      async ({ build, outputDir }) => {
        await build({
          createConnector: await nordicConnectors({}),
          fetchErrors: { "dk-fstyr": "HTTP 503 while fetching https://example.test/" },
        });

        const findings = findingsOf(await readDiscrepancies(outputDir)).filter(
          (finding) => finding.issuingRegistryId === "dk-fstyr",
        );
        const categories = findings.map((finding) => finding.category);
        expect(categories).toContain("SOURCE_UNAVAILABLE");
        expect(categories).not.toContain("REMOVED_FROM_ISSUING_REGISTER");
        expect(categories).not.toContain("NOT_FOUND_IN_ISSUING_REGISTER");
        expect(
          findings
            .filter((finding) => finding.category === "ISSUING_REGISTER_UNVERIFIABLE")
            .map((finding) => finding.identifier?.eMobilityId ?? "")
            .toSorted(),
        ).toEqual(["DKMON", "DKOLD"]);
      },
      { sourceIds: NORDIC, published: [sampleRecord("dk-fstyr", "DK", "BBB"), removed] },
    );
  });
});

const GENERATED_AT = "2026-06-15T00:00:00.000Z";
const PREVIOUS_RETRIEVAL = "2026-06-14T00:00:00.000Z";

/**
 * Runs the assertions against a throwaway data directory holding two published
 * sources, and hands them a `build` that only needs what the case varies.
 */
async function withWorkspace(
  assertions: (workspace: {
    sources: SourceDefinition[];
    outputDir: string;
    build: (
      overrides?: BuildOptions & { sources?: SourceDefinition[] },
    ) => ReturnType<typeof buildRegistry>;
    /** Makes the last build's datasets the published ones the next build reads. */
    publishOutput: () => Promise<void>;
  }) => Promise<void>,
  setup: {
    sourceIds?: string[];
    published?: NormalizedRegistryRecord[];
    /** Published health per source, over the current default; `null` publishes none. */
    health?: Record<string, Partial<PublishedSourceHealth> | null>;
  } = {},
) {
  const dataDir = await mkdtemp(join(tmpdir(), "open-idro-build-data-"));
  const outputDir = await mkdtemp(join(tmpdir(), "open-idro-build-out-"));
  try {
    const sources = await Promise.all(
      (setup.sourceIds ?? ["fr-afirev", "dk-fstyr"]).map((id) => loadSourceDefinition(id)),
    );
    await writeWorkspace(
      dataDir,
      sources,
      setup.published ?? [
        sampleRecord("fr-afirev", "FR", "AAA"),
        sampleRecord("dk-fstyr", "DK", "BBB"),
      ],
      setup.health,
    );
    const publishOutput = async () => {
      await mkdir(join(dataDir, "reports"), { recursive: true });
      for (const file of [
        "registry.json",
        "sources.json",
        "registry-invalid.json",
        join("reports", "discrepancies.json"),
      ]) {
        await copyFile(join(outputDir, file), join(dataDir, file));
      }
    };
    const build = ({
      sources: override,
      ...options
    }: BuildOptions & { sources?: SourceDefinition[] } = {}) =>
      buildRegistry(override ?? sources, {
        dataDir,
        outputDir,
        generatedAt: GENERATED_AT,
        // Connectors set the observation block; the published records predate it.
        createConnector: connectorReturning([
          withObservationBlock(sampleRecord("fr-afirev", "FR", "AAA"), {
            kind: "ASSIGNMENT",
            observingJurisdiction: "FR",
          }),
        ]),
        ...options,
      });
    await assertions({ sources, outputDir, build, publishOutput });
  } finally {
    await rm(dataDir, { recursive: true, force: true });
    await rm(outputDir, { recursive: true, force: true });
  }
}

async function writeWorkspace(
  dataDir: string,
  sources: SourceDefinition[],
  published: NormalizedRegistryRecord[],
  health: Record<string, Partial<PublishedSourceHealth> | null> = {},
) {
  await writeFile(join(dataDir, "registry.json"), JSON.stringify(published));
  await writeFile(
    join(dataDir, "sources.json"),
    JSON.stringify(
      sources
        .filter((source) => health[source.id] !== null)
        .map((source) => ({
          id: source.id,
          health: {
            stale: false,
            recordCount: 1,
            lastAttemptedRetrieval: PREVIOUS_RETRIEVAL,
            lastSuccessfulRetrieval: PREVIOUS_RETRIEVAL,
            checksum: "previous-checksum",
            freshness: "current",
            latestErrorSummary: null,
            ...health[source.id],
          },
        })),
    ),
  );
  for (const source of sources) {
    const dir = join(dataDir, "raw", source.id, "current");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "body.json"), "{}");
    await writeFile(
      join(dir, "metadata.json"),
      JSON.stringify({
        sourceId: source.id,
        contentType: "application/json",
        finalUrl: "https://example.test/",
        httpStatus: 200,
        retrievedAt: GENERATED_AT,
        etag: null,
        lastModified: null,
        checksum: "snapshot-checksum",
      }),
    );
  }
}

async function readHealth(outputDir: string, sourceId: string) {
  const summaries = JSON.parse(await readFile(join(outputDir, "sources.json"), "utf8")) as {
    id: string;
    health: Record<string, unknown>;
  }[];
  return summaries.find((summary) => summary.id === sourceId)?.health;
}

function connectorReturning(
  records: NormalizedRegistryRecord[],
  errors: ValidationIssue[] = [],
  warnings: ValidationIssue[] = [],
): () => RegistryConnector {
  return () => ({
    sourceId: "stub",
    fetch: async () => {
      throw new Error("not used by the build");
    },
    parse: async () => ({ records: [], warnings: [], errors: [] }),
    normalize: async () => ({ records, warnings, errors }),
  });
}

async function readDiscrepancies(outputDir: string) {
  return JSON.parse(
    await readFile(join(outputDir, "reports", "discrepancies.json"), "utf8"),
  ) as DiscrepancyReport;
}

function findingsOf(report: DiscrepancyReport) {
  return report.countries.flatMap((country) => country.pairs.flatMap((pair) => pair.findings));
}

/** An assignment the issuing register listed in this run's retrieval. */
function assignedThisRun(registryId: string, countryCode: string, partyId: string) {
  const record = withObservationBlock(sampleRecord(registryId, countryCode, partyId), {
    kind: "ASSIGNMENT",
    observingJurisdiction: countryCode,
  });
  return {
    ...record,
    source: { ...record.source, lastSeenAt: GENERATED_AT, retrievedAt: GENERATED_AT },
  };
}

async function swedishListings(...sourceValues: string[]) {
  const sweden = await loadSourceDefinition("se-energimyndigheten");
  const normalized = await new EnergimyndighetenConnector().normalize({
    source: sweden,
    retrievedAt: GENERATED_AT,
    records: sourceValues.map((sourceValue) => ({
      sourceValue,
      organizationName: "Example",
      role: "CPO",
      sourceUrl: "https://example.test/",
    })),
  });
  return normalized.records;
}

function issuingOf(records: NormalizedRegistryRecord[], key: string) {
  return records.find((record) => identifierRoleKey(record) === key)?.issuing;
}

function issuingByIdentifier(records: NormalizedRegistryRecord[]) {
  return Object.fromEntries(records.map((record) => [identifierRoleKey(record), record.issuing]));
}

function withObservationBlock(
  record: NormalizedRegistryRecord,
  observation: RegistryObservation,
): NormalizedRegistryRecord {
  return { ...record, source: { ...record.source, observation } };
}

function sampleRecord(
  registryId: string,
  countryCode: string,
  partyId: string,
): NormalizedRegistryRecord {
  return {
    key: `${registryId}:${countryCode}:${partyId}:CPO`,
    countryCode,
    partyId,
    eMobilityId: `${countryCode}${partyId}`,
    role: "CPO",
    status: "ACTIVE",
    organization: { name: "Example", legalName: null, website: null },
    source: {
      registryId,
      official: true,
      sourceRecordId: `${countryCode}${partyId}`,
      sourceUrl: "https://example.test/",
      sourceValue: `${countryCode}${partyId}`,
      firstSeenAt: PREVIOUS_RETRIEVAL,
      lastSeenAt: PREVIOUS_RETRIEVAL,
      retrievedAt: PREVIOUS_RETRIEVAL,
    },
    metadata: {},
  };
}
