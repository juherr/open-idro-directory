import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { NormalizedRegistryRecord } from "../../src/domain/registry-record.js";
import { loadSourceDefinition } from "../../src/infrastructure/filesystem/source-loader.js";
import { writeDatasets } from "../../src/infrastructure/serialization/serializers.js";

const generatedAt = "2026-06-14T00:00:00.000Z";

// DK*MON as the Swedish register lists it: a Danish identifier, confirmed by
// the Danish register.
const listedDkMon = record("DK", "MON", {
  observation: { kind: "CROSS_REGISTER_LISTING", observingJurisdiction: "SE" },
  issuing: { country: "DK", confirmation: "CONFIRMED", confirmedBy: ["dk-fstyr"] },
});
const assigned = record("SE", "ABC", {
  observation: { kind: "ASSIGNMENT", observingJurisdiction: "SE" },
  issuing: { country: "SE", confirmation: "CONFIRMED", confirmedBy: ["se-energimyndigheten"] },
});
const notFound = record("DK", "NFD", {
  observation: { kind: "CROSS_REGISTER_LISTING", observingJurisdiction: "SE" },
  issuing: { country: "DK", confirmation: "NOT_FOUND", confirmedBy: [] },
});
// Published before either block existed.
const legacyAssignment = record("SE", "OLD", {});
const legacyListing = record("DK", "LEG", {});

describe("issuing confirmation in the published datasets", () => {
  let outputDir: string;

  beforeEach(async () => {
    outputDir = await mkdtemp(join(tmpdir(), "open-idro-dataset-issuing-"));
  });

  afterEach(async () => {
    await rm(outputDir, { recursive: true, force: true });
  });

  async function write(records: NormalizedRegistryRecord[]) {
    const source = await loadSourceDefinition("se-energimyndigheten");
    await writeDatasets(records, [source], [], generatedAt, outputDir);
  }

  async function csvRows() {
    const lines = (await readFile(join(outputDir, "registry.csv"), "utf8")).trimEnd().split("\n");
    // The header is written bare, every cell quoted; no fixture value holds a
    // comma or a quote.
    const [header = "", ...rows] = lines;
    const names = header.split(",");
    return rows.map((row) => {
      const cells = row.slice(1, -1).split('","');
      return Object.fromEntries(names.map((name, index) => [name, cells[index]]));
    });
  }

  it("appends the issuing and observation columns after retrievedAt", async () => {
    await write([assigned]);

    const header = (await readFile(join(outputDir, "registry.csv"), "utf8")).split("\n")[0];
    expect(header?.split(",").slice(-4)).toEqual([
      "retrievedAt",
      "issuingCountry",
      "issuingConfirmation",
      "observationKind",
    ]);
  });

  it("writes the issuing block and the observation kind of each record", async () => {
    await write([listedDkMon, assigned]);

    const rows = await csvRows();
    expect(rows.find((row) => row.key === listedDkMon.key)).toMatchObject({
      countryCode: "DK",
      registryId: "se-energimyndigheten",
      issuingCountry: "DK",
      issuingConfirmation: "CONFIRMED",
      observationKind: "CROSS_REGISTER_LISTING",
    });
    expect(rows.find((row) => row.key === assigned.key)).toMatchObject({
      issuingCountry: "SE",
      issuingConfirmation: "CONFIRMED",
      observationKind: "ASSIGNMENT",
    });
  });

  it("leaves the issuing cells empty and derives the kind for records without the blocks", async () => {
    await write([legacyAssignment, legacyListing]);

    const rows = await csvRows();
    expect(rows.find((row) => row.key === legacyAssignment.key)).toMatchObject({
      issuingCountry: "",
      issuingConfirmation: "",
      observationKind: "ASSIGNMENT",
    });
    expect(rows.find((row) => row.key === legacyListing.key)).toMatchObject({
      issuingCountry: "",
      issuingConfirmation: "",
      observationKind: "CROSS_REGISTER_LISTING",
    });
  });

  it("leaves the kind empty for a record of a register no source describes", async () => {
    const orphan = record("SE", "ORF", {});
    await write([{ ...orphan, source: { ...orphan.source, registryId: "retired-register" } }]);

    const [row] = await csvRows();
    expect(row?.observationKind).toBe("");
  });

  it("counts records per issuing confirmation, leaving out records without the block", async () => {
    await write([listedDkMon, assigned, notFound, legacyAssignment]);

    const stats = JSON.parse(await readFile(join(outputDir, "stats.json"), "utf8"));
    expect(stats.recordsByIssuingConfirmation).toEqual({ CONFIRMED: 2, NOT_FOUND: 1 });
    expect(Object.keys(stats.recordsByIssuingConfirmation)).toEqual(["CONFIRMED", "NOT_FOUND"]);
  });
});

function record(
  countryCode: string,
  partyId: string,
  blocks: Pick<NormalizedRegistryRecord, "issuing"> & {
    observation?: NormalizedRegistryRecord["source"]["observation"];
  },
): NormalizedRegistryRecord {
  return {
    key: `se-energimyndigheten:${countryCode}:${partyId}:CPO`,
    countryCode,
    partyId,
    eMobilityId: `${countryCode}${partyId}`,
    role: "CPO",
    status: "ACTIVE",
    organization: { name: "Example", legalName: null, website: null },
    source: {
      registryId: "se-energimyndigheten",
      official: countryCode === "SE",
      sourceRecordId: `${countryCode}${partyId}`,
      sourceUrl:
        "https://www.energimyndigheten.se/globalassets/klimat/laddinfrastruktur/register-av-identifieringsdata.xlsx",
      sourceValue: `${countryCode}*${partyId}`,
      firstSeenAt: generatedAt,
      lastSeenAt: generatedAt,
      retrievedAt: generatedAt,
      ...(blocks.observation ? { observation: blocks.observation } : {}),
    },
    metadata: {},
    ...(blocks.issuing ? { issuing: blocks.issuing } : {}),
  };
}
