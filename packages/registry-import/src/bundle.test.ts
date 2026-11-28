import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { E2E_FIXTURE, writeE2eDataset } from "../../../tests/e2e/fixtures/dataset.js";
import {
  buildImportBundle,
  toImportSql,
  toObservations,
  toRegistryRows,
  writeImportBundle,
} from "./bundle.js";

describe("Cloudflare import bundle", () => {
  it("builds deterministic active-release rows from generated data", async () => {
    const bundle = await buildImportBundle();
    expect(bundle.release.record_count).toBe(bundle.observations.length);
    expect(bundle.manifest.files["observations.ndjson"]?.rows).toBe(bundle.observations.length);
    expect(bundle.parties.length).toBeGreaterThan(0);
    expect(bundle.observations[0]?.dataset_release_id).toBe(bundle.release.id);
    expect(bundle.sources.every((source) => source.reuse_status.length > 0)).toBe(true);
    expect(bundle.sources).not.toContainEqual(
      expect.objectContaining({ license_status: expect.anything() }),
    );
    expect(bundle.sources).toContainEqual(
      expect.objectContaining({
        id: "fi-traficom",
        reuse_status: "licensed",
        reuse_licence_name: "CC BY 4.0",
        reuse_licence_url:
          "https://traficom.fi/en/transport-system/geoinformationsmaterial/use-and-licences-data",
        reuse_attribution_notice: expect.stringContaining("Traficom"),
        reuse_redistribution_allowed: 1,
      }),
    );
    expect(bundle.sources).toContainEqual(
      expect.objectContaining({
        id: "ie-tii",
        reuse_status: "licensed",
        reuse_licence_name: "CC BY 4.0",
        reuse_licence_url: "https://www.tii.ie/en/compliance/reuse-of-public-sector-information/",
        reuse_attribution_notice:
          "Contains Irish Public Sector Information licensed under a Creative Commons Attribution 4.0 International (CC BY 4.0) licence",
        reuse_redistribution_allowed: 1,
      }),
    );
  });

  it("carries the roles each registry declares, including CPO-only and disabled ones", async () => {
    const bundle = await buildImportBundle();
    const roles = (id: string) =>
      bundle.sources.find((source) => source.id === id)?.supported_roles_json;

    expect(roles("at-ladestellen")).toBe('["CPO"]');
    expect(roles("cy-ems")).toBe('["CPO","EMSP"]');
  });

  it("reports a disabled source as disabled rather than stale", async () => {
    const bundle = await buildImportBundle();
    const cyprus = bundle.sources.find((source) => source.id === "cy-ems");

    expect(cyprus).toMatchObject({ health_status: "disabled", freshness_status: "disabled" });
  });

  it("emits one authority row per authority and takes levels from the descriptor", async () => {
    const bundle = await buildImportBundle();

    expect(bundle.authorities).toContainEqual(
      expect.objectContaining({
        id: "fi-traficom",
        name: "Finnish Transport and Communications Agency Traficom",
        level: "AUTHORITATIVE",
        homepage_url: expect.stringContaining("traficom.fi"),
      }),
    );

    // Every source resolves to a catalogued authority, and the catalog is not
    // simply one row per source -- it is keyed on the authority itself.
    const authorityIds = bundle.authorities.map((authority) => authority.id);
    expect(authorityIds).toEqual([...authorityIds].sort());
    expect(bundle.authorities.length).toBeLessThanOrEqual(bundle.sources.length);

    const finland = bundle.sources.find((source) => source.id === "fi-traficom");
    expect(finland).toMatchObject({
      authority_id: "fi-traficom",
      authority_level: "AUTHORITATIVE",
      observation_type: "OFFICIAL_ASSIGNMENT",
    });
    for (const source of bundle.sources) {
      expect(authorityIds).toContain(source.authority_id);
    }
  });

  it("carries a non-authoritative level that the old boolean could not express", () => {
    // The five-level taxonomy only differs from the old boolean when a source is
    // not AUTHORITATIVE. No published source is, so this uses a synthetic one --
    // reinstating `official ? "AUTHORITATIVE" : "SECONDARY"` fails here.
    const directory = {
      id: "eu-eafo",
      authority: { id: "eu-eafo", level: "SUPRANATIONAL_DIRECTORY", jurisdictions: ["FR"] },
      registry: { observationType: "OFFICIAL_DIRECTORY_ENTRY", jurisdictions: ["FR"] },
    } as never;
    const record = {
      key: "eu-eafo:FR:ABC:CPO",
      countryCode: "FR",
      partyId: "ABC",
      eMobilityId: "FRABC",
      role: "CPO",
      status: "ACTIVE",
      organization: { name: null, legalName: null, website: null },
      source: {
        registryId: "eu-eafo",
        official: true,
        sourceRecordId: null,
        sourceUrl: "https://example.org/register",
        sourceValue: "FRABC",
        firstSeenAt: "2026-01-01T00:00:00.000Z",
        lastSeenAt: "2026-01-01T00:00:00.000Z",
        retrievedAt: "2026-01-01T00:00:00.000Z",
      },
      metadata: {},
    } as never;

    const [observation] = toObservations([record], [directory], "release-1");

    expect(observation?.authority_level).toBe("SUPRANATIONAL_DIRECTORY");
    expect(observation?.observation_type).toBe("OFFICIAL_DIRECTORY_ENTRY");
  });

  it("takes observation authority levels from the descriptor, not from a boolean", async () => {
    const bundle = await buildImportBundle();
    const sourceById = new Map(bundle.sources.map((source) => [source.id, source]));

    // Regression guard: observation rows used to hardcode
    // `official ? "AUTHORITATIVE" : "SECONDARY"`, collapsing the five-level
    // taxonomy. Records covered by their source's authority must now carry the
    // level and observation type that source actually declares.
    for (const observation of bundle.observations) {
      const source = sourceById.get(observation.source_id);
      expect(source).toBeDefined();
      if (observation.authority_level === "SECONDARY") continue;
      expect(observation.authority_level).toBe(source?.authority_level);
      expect(observation.observation_type).toBe(source?.observation_type);
    }

    // EV Roam is authoritative for GB but only cross-registers IE identifiers,
    // so the per-record downgrade must survive the descriptor lookup.
    const evroamIe = bundle.observations.filter(
      (observation) => observation.source_id === "gb-evroam" && observation.country_code === "IE",
    );
    expect(evroamIe.length).toBeGreaterThan(0);
    for (const observation of evroamIe) {
      expect(observation.authority_level).toBe("SECONDARY");
      expect(observation.observation_type).toBe("OFFICIAL_DIRECTORY_ENTRY");
    }
  });

  it("writes D1 remote-compatible import SQL", async () => {
    await writeImportBundle();

    const sql = await readFile("build/cloudflare/import.sql", "utf8");
    expect(sql).not.toMatch(/\bBEGIN\s+TRANSACTION\b/i);
    expect(sql).not.toMatch(/\bSAVEPOINT\b/i);
    expect(sql).not.toMatch(/\bCOMMIT\b/i);
    expect(
      sql.startsWith(
        [
          "DELETE FROM active_dataset;",
          "DELETE FROM conflicts;",
          "DELETE FROM observations;",
          "DELETE FROM party_roles;",
          "DELETE FROM parties;",
          "DELETE FROM sources;",
          "DELETE FROM authorities;",
          "DELETE FROM dataset_releases;",
        ].join("\n"),
      ),
    ).toBe(true);
    expect(sql).toContain("INSERT INTO active_dataset");
    expect(/INSERT INTO sources \([^)]*\bsupported_roles_json\b/.test(sql)).toBe(true);
  });

  it("imports the generated SQL into a database migrated with every migration", async () => {
    const bundle = await buildImportBundle();
    const db = await migratedDatabase();

    db.exec(toImportSql(bundle));

    const count = db.prepare("SELECT COUNT(*) AS count FROM observations").get() as {
      count: number;
    };
    expect(count.count).toBe(bundle.observations.length);
    // The committed dataset predates the observation and issuing blocks: the
    // kind is derived from the source, the confirmation stays NULL.
    const kinds = db
      .prepare("SELECT DISTINCT observation_kind AS kind FROM observations ORDER BY kind")
      .all() as Array<{ kind: string | null }>;
    expect(kinds.map((row) => row.kind)).not.toContain(null);
  });

  it("builds a bundle from another data directory into another output directory", async () => {
    const workDir = await mkdtemp(resolve(tmpdir(), "registry-import-"));
    try {
      const dataDir = resolve(workDir, "data");
      const outputDir = resolve(workDir, "bundle");
      const records = await writeE2eDataset(dataDir);

      const bundle = await buildImportBundle({ dataDir });
      await writeImportBundle(bundle, { outputDir });

      expect(bundle.observations).toHaveLength(records.length);
      expect(bundle.sources.map((source) => source.id).sort()).toEqual([
        "cy-ems",
        "de-bdew",
        "fr-afirev",
      ]);
      const sql = await readFile(resolve(outputDir, "import.sql"), "utf8");
      expect(sql).toContain("Shared Mobility Germany");
      const db = await migratedDatabase();
      db.exec(sql);
      const parties = db
        .prepare("SELECT country_code AS country, COUNT(*) AS count FROM parties GROUP BY 1")
        .all() as Array<{ country: string; count: number }>;
      expect(Object.fromEntries(parties.map((row) => [row.country, row.count]))).toEqual({
        DE: 2,
        FR: E2E_FIXTURE.voltlineCount + 3,
      });
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  });
});

describe("issuing confirmation and observation kinds", () => {
  const dkFstyr = summary("dk-fstyr", ["DK"]);
  const seEnergimyndigheten = summary("se-energimyndigheten", ["SE"]);
  const beneluxIdro = summary("benelux-idro", ["BE", "NL", "LU"]);
  const plEipa = summary("pl-eipa", ["PL"]);
  const gbEvroam = summary("gb-evroam", ["GB"], ["GB", "IE"]);
  const fiTraficom = summary("fi-traficom", ["FI"]);
  const sources = [dkFstyr, seEnergimyndigheten, beneluxIdro, plEipa, gbEvroam, fiTraficom];

  const monConfirmed = { country: "DK", confirmation: "CONFIRMED", confirmedBy: ["dk-fstyr"] };
  const dkMon = [
    record("dk-fstyr", "DK", "MON", {
      name: "Monta ApS",
      official: true,
      retrievedAt: "2026-01-01T00:00:00.000Z",
      observation: { kind: "ASSIGNMENT", observingJurisdiction: "DK" },
      issuing: monConfirmed,
    }),
    // Retrieved later than the Danish assignment: a newest-first tie-break
    // alone would take the Swedish listing's name.
    record("se-energimyndigheten", "DK", "MON", {
      name: "Monta AB",
      official: false,
      retrievedAt: "2026-02-01T00:00:00.000Z",
      observation: { kind: "CROSS_REGISTER_LISTING", observingJurisdiction: "SE" },
      issuing: monConfirmed,
    }),
  ];

  it("keeps a Swedish listing of DK*MON apart from the Danish assignment", () => {
    const rows = toRegistryRows(dkMon, sources, "release-1");

    expect(rows.observations).toEqual([
      expect.objectContaining({
        source_id: "dk-fstyr",
        observation_kind: "ASSIGNMENT",
        observing_jurisdiction: "DK",
        authority_level: "AUTHORITATIVE",
        observation_type: "OFFICIAL_ASSIGNMENT",
      }),
      expect.objectContaining({
        source_id: "se-energimyndigheten",
        observation_kind: "CROSS_REGISTER_LISTING",
        observing_jurisdiction: "SE",
        authority_level: "SECONDARY",
        observation_type: "OFFICIAL_DIRECTORY_ENTRY",
      }),
    ]);
    expect(rows.partyRoles).toEqual([
      expect.objectContaining({
        party_key: "DK:MON",
        role: "CPO",
        issuing_confirmation: "CONFIRMED",
        issuing_confirmed_by_json: '["dk-fstyr"]',
        highest_authority_level: "AUTHORITATIVE",
        observation_count: 2,
      }),
    ]);
    expect(rows.parties).toEqual([
      expect.objectContaining({
        key: "DK:MON",
        preferred_name: "Monta ApS",
        highest_authority_level: "AUTHORITATIVE",
        observation_count: 2,
      }),
    ]);
  });

  it("keeps a Polish listing of NL*TNM apart from the Benelux assignment", () => {
    const issuing = { country: "NL", confirmation: "CONFIRMED", confirmedBy: ["benelux-idro"] };
    const rows = toRegistryRows(
      [
        record("pl-eipa", "NL", "TNM", {
          official: false,
          observation: { kind: "CROSS_REGISTER_LISTING", observingJurisdiction: "PL" },
          issuing,
        }),
        record("benelux-idro", "NL", "TNM", {
          official: true,
          observation: { kind: "ASSIGNMENT", observingJurisdiction: "NL" },
          issuing,
        }),
      ],
      sources,
      "release-1",
    );

    expect(
      rows.observations.map((row) => [
        row.source_id,
        row.observation_kind,
        row.observing_jurisdiction,
        row.authority_level,
      ]),
    ).toEqual([
      ["benelux-idro", "ASSIGNMENT", "NL", "AUTHORITATIVE"],
      ["pl-eipa", "CROSS_REGISTER_LISTING", "PL", "SECONDARY"],
    ]);
    expect(rows.partyRoles[0]).toMatchObject({
      issuing_confirmation: "CONFIRMED",
      issuing_confirmed_by_json: '["benelux-idro"]',
      highest_authority_level: "AUTHORITATIVE",
    });
    expect(rows.parties[0]?.highest_authority_level).toBe("AUTHORITATIVE");
  });

  it("rates an identifier only listed outside its country as secondary", () => {
    // No source covers Norway: the Swedish listing is the only observation.
    const rows = toRegistryRows(
      [
        record("se-energimyndigheten", "NO", "ABC", {
          official: false,
          observation: { kind: "CROSS_REGISTER_LISTING", observingJurisdiction: "SE" },
          issuing: { country: "NO", confirmation: "NO_ISSUING_SOURCE", confirmedBy: [] },
        }),
      ],
      sources,
      "release-1",
    );

    expect(rows.partyRoles).toEqual([
      expect.objectContaining({
        party_key: "NO:ABC",
        issuing_confirmation: "NO_ISSUING_SOURCE",
        issuing_confirmed_by_json: "[]",
        highest_authority_level: "SECONDARY",
      }),
    ]);
    expect(rows.parties[0]?.highest_authority_level).toBe("SECONDARY");
  });

  it("derives the kind of a record published without the blocks", () => {
    const rows = toRegistryRows(
      [
        record("fi-traficom", "FI", "ABC", { official: true }),
        record("gb-evroam", "IE", "XYZ", { official: false }),
      ],
      sources,
      "release-1",
    );

    expect(
      rows.observations.map((row) => [
        row.source_id,
        row.observation_kind,
        row.observing_jurisdiction,
        row.authority_level,
      ]),
    ).toEqual([
      ["fi-traficom", "ASSIGNMENT", "FI", "AUTHORITATIVE"],
      ["gb-evroam", "CROSS_REGISTER_LISTING", "GB", "SECONDARY"],
    ]);
    expect(rows.partyRoles.map((row) => [row.party_key, row.issuing_confirmation])).toEqual([
      ["FI:ABC", null],
      ["IE:XYZ", null],
    ]);
    expect(rows.partyRoles.every((row) => row.issuing_confirmed_by_json === null)).toBe(true);
    expect(rows.parties.map((row) => [row.key, row.highest_authority_level])).toEqual([
      ["FI:ABC", "AUTHORITATIVE"],
      ["IE:XYZ", "SECONDARY"],
    ]);
  });

  it("falls back on the official flag for a register sources.json does not describe", () => {
    const rows = toRegistryRows(
      [
        record("retired-register", "FI", "OLD", { official: true }),
        record("retired-register", "FI", "LST", { official: false }),
      ],
      sources,
      "release-1",
    );

    expect(
      rows.observations.map((row) => [
        row.party_key,
        row.observation_kind,
        row.observing_jurisdiction,
        row.authority_level,
        row.observation_type,
      ]),
    ).toEqual([
      ["FI:LST", null, null, "SECONDARY", "OFFICIAL_DIRECTORY_ENTRY"],
      ["FI:OLD", null, null, "AUTHORITATIVE", "OFFICIAL_ASSIGNMENT"],
    ]);
  });

  it("keeps the block a record of a register sources.json does not describe carries", () => {
    const rows = toRegistryRows(
      [
        record("retired-register", "FI", "OLD", {
          official: true,
          observation: { kind: "CROSS_REGISTER_LISTING", observingJurisdiction: "SE" },
        }),
      ],
      sources,
      "release-1",
    );

    expect(
      rows.observations.map((row) => [
        row.party_key,
        row.observation_kind,
        row.observing_jurisdiction,
        row.authority_level,
        row.observation_type,
      ]),
    ).toEqual([
      ["FI:OLD", "CROSS_REGISTER_LISTING", "SE", "SECONDARY", "OFFICIAL_DIRECTORY_ENTRY"],
    ]);
  });

  it("ignores an authority level the schema does not know when ranking", () => {
    const legacy = {
      ...(summary("legacy-register", ["FI"]) as object),
      authority: { id: "legacy-register", level: "LEGACY_LEVEL", jurisdictions: ["FI"] },
    } as never;
    const rows = toRegistryRows(
      [
        record("fi-traficom", "FI", "ABC", {
          official: true,
          observation: { kind: "ASSIGNMENT", observingJurisdiction: "FI" },
        }),
        record("legacy-register", "FI", "ABC", {
          official: true,
          observation: { kind: "ASSIGNMENT", observingJurisdiction: "FI" },
        }),
      ],
      [...sources, legacy],
      "release-1",
    );

    expect(rows.observations.map((row) => row.authority_level).sort()).toEqual([
      "AUTHORITATIVE",
      "LEGACY_LEVEL",
    ]);
    expect(rows.partyRoles[0]?.highest_authority_level).toBe("AUTHORITATIVE");
    expect(rows.parties[0]?.highest_authority_level).toBe("AUTHORITATIVE");
  });

  it("round-trips the new columns through the migrated schema", async () => {
    const bundle = await buildImportBundle();
    const rows = toRegistryRows(dkMon, sources, bundle.release.id);
    const db = await migratedDatabase();

    db.exec(toImportSql({ ...bundle, ...rows, conflicts: [] }));

    expect(
      db
        .prepare(
          "SELECT issuing_confirmation, issuing_confirmed_by_json, highest_authority_level FROM party_roles WHERE party_key = 'DK:MON'",
        )
        .get(),
    ).toEqual({
      issuing_confirmation: "CONFIRMED",
      issuing_confirmed_by_json: '["dk-fstyr"]',
      highest_authority_level: "AUTHORITATIVE",
    });
    expect(
      db
        .prepare(
          "SELECT source_id, observation_kind, observing_jurisdiction FROM observations WHERE party_key = 'DK:MON' ORDER BY source_id",
        )
        .all(),
    ).toEqual([
      { source_id: "dk-fstyr", observation_kind: "ASSIGNMENT", observing_jurisdiction: "DK" },
      {
        source_id: "se-energimyndigheten",
        observation_kind: "CROSS_REGISTER_LISTING",
        observing_jurisdiction: "SE",
      },
    ]);
  });
});

async function migratedDatabase() {
  const migrationsDir = resolve(import.meta.dirname, "../../../apps/api/migrations");
  const db = new DatabaseSync(":memory:");
  for (const file of (await readdir(migrationsDir))
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    db.exec(await readFile(resolve(migrationsDir, file), "utf8"));
  }
  return db;
}

function summary(id: string, jurisdictions: string[], authorityJurisdictions = jurisdictions) {
  return {
    id,
    authority: { id, level: "AUTHORITATIVE", jurisdictions: authorityJurisdictions },
    registry: { observationType: "OFFICIAL_ASSIGNMENT", jurisdictions },
  } as never;
}

function record(
  registryId: string,
  countryCode: string,
  partyId: string,
  options: {
    official: boolean;
    name?: string;
    retrievedAt?: string;
    observation?: { kind: string; observingJurisdiction: string | null };
    issuing?: { country: string; confirmation: string; confirmedBy: string[] };
  },
) {
  const retrievedAt = options.retrievedAt ?? "2026-01-01T00:00:00.000Z";
  return {
    key: `${registryId}:${countryCode}:${partyId}:CPO`,
    countryCode,
    partyId,
    eMobilityId: `${countryCode}${partyId}`,
    role: "CPO",
    status: "ACTIVE",
    organization: { name: options.name ?? `${partyId} Ltd`, legalName: null, website: null },
    source: {
      registryId,
      official: options.official,
      sourceRecordId: null,
      sourceUrl: "https://example.org/register",
      sourceValue: `${countryCode}*${partyId}`,
      firstSeenAt: retrievedAt,
      lastSeenAt: retrievedAt,
      retrievedAt,
      ...(options.observation ? { observation: options.observation } : {}),
    },
    metadata: {},
    ...(options.issuing ? { issuing: options.issuing } : {}),
  } as never;
}
