import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  normalizedRegistryRecordSchema,
  type NormalizedRegistryRecord,
  type RegistryRole,
  type RegistryStatus,
} from "../../registry-model/src/index.js";
import {
  API_SCHEMA_VERSION,
  IMPORTER_VERSION,
  type ConflictRow,
  type DatasetReleaseRow,
  type ImportManifest,
  type ObservationRow,
  type PartyRoleRow,
  type PartyRow,
  type SourceRow,
} from "./types.js";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const outputDir = resolve(rootDir, "build/cloudflare");
const deterministicImportTimestamp = "1970-01-01T00:00:00.000Z";

interface SourceSummary {
  id: string;
  name: string;
  authorityName: string;
  jurisdictions: string[];
  official: boolean;
  enabled: boolean;
  homepageUrl: string | null;
  registryUrl: string | null;
  supportedRoles: string[];
  license: {
    status: string;
    name: string | null;
    url: string | null;
  };
  health: {
    stale: boolean;
    recordCount: number;
    lastAttemptedRetrieval: string | null;
    lastSuccessfulRetrieval: string | null;
    checksum: string | null;
    freshness: string;
    latestErrorSummary: string | null;
  };
}

interface StatsSummary {
  generatedAt: string;
  totalRecords: number;
}

interface ConflictReport {
  generatedAt?: string;
  conflicts?: Array<{
    category: string;
    observationKey: string;
    officialKey?: string;
    sourceId: string;
    message: string;
  }>;
}

export interface ImportBundle {
  release: DatasetReleaseRow;
  sources: SourceRow[];
  parties: PartyRow[];
  partyRoles: PartyRoleRow[];
  observations: ObservationRow[];
  conflicts: ConflictRow[];
  manifest: ImportManifest;
}

export async function buildImportBundle() {
  const records = await readRegistryRecords();
  const sources = (await readJson("data/sources.json")) as SourceSummary[];
  const stats = (await readJson("data/stats.json")) as StatsSummary;
  const conflictsReport = (await readOptionalJson("data/reports/non-idrr-conflicts.json", {
    conflicts: [],
  })) as ConflictReport;
  const gitCommitSha = git(["rev-parse", "HEAD"]);
  const gitRef = git(["rev-parse", "--abbrev-ref", "HEAD"]);
  const generatedAt = stats.generatedAt;
  const datasetChecksum = sha256(JSON.stringify(records));
  const datasetReleaseId = `${generatedAt.replace(/[-:.TZ]/g, "").slice(0, 14)}-${gitCommitSha.slice(0, 12)}`;
  const observations = toOfficialObservations(records, datasetReleaseId);
  const parties = toParties(records, observations, datasetReleaseId);
  const partyRoles = toPartyRoles(records, observations, datasetReleaseId);
  const sourceRows = toSources(sources, datasetReleaseId);
  const conflicts = toConflicts(conflictsReport, records, datasetReleaseId);
  const release: DatasetReleaseRow = {
    id: datasetReleaseId,
    git_commit_sha: gitCommitSha,
    git_ref: gitRef,
    generated_at: generatedAt,
    imported_at: deterministicImportTimestamp,
    dataset_checksum: datasetChecksum,
    schema_version: API_SCHEMA_VERSION,
    record_count: records.length,
    source_count: sources.length,
    importer_version: IMPORTER_VERSION,
  };
  const files = {
    "release.json": JSON.stringify(release, null, 2) + "\n",
    "sources.ndjson": toNdjson(sourceRows),
    "parties.ndjson": toNdjson(parties),
    "party-roles.ndjson": toNdjson(partyRoles),
    "observations.ndjson": toNdjson(observations),
    "conflicts.ndjson": toNdjson(conflicts),
  };
  const manifest: ImportManifest = {
    schemaVersion: API_SCHEMA_VERSION,
    gitCommitSha,
    gitRef,
    generatedAt,
    datasetReleaseId,
    datasetChecksum,
    importerVersion: IMPORTER_VERSION,
    files: Object.fromEntries(
      Object.entries(files).map(([fileName, body]) => [
        fileName,
        { sha256: sha256(body), rows: fileName.endsWith(".json") ? 1 : countNdjsonRows(body) },
      ]),
    ),
    recordCount: records.length,
    sourceCount: sources.length,
  };
  return { release, sources: sourceRows, parties, partyRoles, observations, conflicts, manifest };
}

export async function writeImportBundle(bundle?: ImportBundle) {
  bundle ??= await buildImportBundle();
  await mkdir(outputDir, { recursive: true });
  const files = new Map<string, string>([
    ["release.json", JSON.stringify(bundle.release, null, 2) + "\n"],
    ["sources.ndjson", toNdjson(bundle.sources)],
    ["parties.ndjson", toNdjson(bundle.parties)],
    ["party-roles.ndjson", toNdjson(bundle.partyRoles)],
    ["observations.ndjson", toNdjson(bundle.observations)],
    ["conflicts.ndjson", toNdjson(bundle.conflicts)],
    ["manifest.json", JSON.stringify(bundle.manifest, null, 2) + "\n"],
  ]);
  const checksums = [...files.entries()]
    .map(([fileName, body]) => `${sha256(body)}  ${fileName}`)
    .sort()
    .join("\n");
  files.set("checksums.sha256", `${checksums}\n`);
  files.set("import.sql", toImportSql(bundle));
  await Promise.all(
    [...files.entries()].map(([fileName, body]) => writeFile(resolve(outputDir, fileName), body)),
  );
  return bundle.manifest;
}

export async function verifyImportBundle() {
  const manifest = (await readJson("build/cloudflare/manifest.json")) as ImportManifest;
  for (const [fileName, descriptor] of Object.entries(manifest.files)) {
    const body = await readFile(resolve(outputDir, fileName), "utf8");
    if (sha256(body) !== descriptor.sha256) throw new Error(`Checksum mismatch for ${fileName}`);
    if (countRows(fileName, body) !== descriptor.rows)
      throw new Error(`Row count mismatch for ${fileName}`);
  }
  return manifest;
}

async function readRegistryRecords() {
  const rawRecords = (await readJson("data/registry.json")) as unknown[];
  return rawRecords.map((record) => normalizedRegistryRecordSchema.parse(record));
}

function toOfficialObservations(records: NormalizedRegistryRecord[], datasetReleaseId: string) {
  return records
    .map<ObservationRow>((record) => ({
      key: record.key,
      party_key: partyKey(record.countryCode, record.partyId),
      source_id: record.source.registryId,
      scheme: schemeForRole(record.role),
      country_code: record.countryCode,
      party_id: record.partyId,
      emobility_id: record.eMobilityId,
      role: record.role,
      status: record.status,
      organization_name: record.organization.name,
      legal_name: record.organization.legalName,
      website: record.organization.website,
      source_record_id: record.source.sourceRecordId,
      source_value: record.source.sourceValue,
      source_url: record.source.sourceUrl,
      authority_level: record.source.official ? "AUTHORITATIVE" : "SECONDARY",
      observation_type: record.source.official ? "OFFICIAL_ASSIGNMENT" : "OFFICIAL_DIRECTORY_ENTRY",
      first_seen_at: record.source.firstSeenAt,
      last_seen_at: record.source.lastSeenAt,
      retrieved_at: record.source.retrievedAt,
      metadata_json: stableJson(record.metadata),
      raw_record_checksum:
        typeof record.metadata.rawSnapshotChecksum === "string"
          ? record.metadata.rawSnapshotChecksum
          : null,
      dataset_release_id: datasetReleaseId,
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

function toParties(
  records: NormalizedRegistryRecord[],
  observations: ObservationRow[],
  datasetReleaseId: string,
) {
  const recordsByParty = groupBy(records, (record) => partyKey(record.countryCode, record.partyId));
  const observationsByParty = groupBy(observations, (observation) => observation.party_key);
  return [...recordsByParty.entries()]
    .map<PartyRow>(([key, partyRecords]) => {
      const selected = selectPreferredRecord(partyRecords);
      const partyObservations = observationsByParty.get(key) ?? [];
      return {
        key,
        country_code: selected.countryCode,
        party_id: selected.partyId,
        emobility_id: selected.eMobilityId,
        preferred_name: selected.organization.name,
        legal_name: selected.organization.legalName,
        website: selected.organization.website,
        consolidated_status: derivePartyStatus(partyRecords),
        highest_authority_level: "AUTHORITATIVE",
        role_count: new Set(partyRecords.map((record) => record.role)).size,
        observation_count: partyObservations.length,
        has_conflict: 0,
        first_seen_at: minIso(partyRecords.map((record) => record.source.firstSeenAt)),
        last_seen_at: maxIso(partyRecords.map((record) => record.source.lastSeenAt)),
        normalized_name: normalizeSearchText(selected.organization.name),
        dataset_release_id: datasetReleaseId,
      };
    })
    .sort(
      (a, b) =>
        a.country_code.localeCompare(b.country_code) || a.party_id.localeCompare(b.party_id),
    );
}

function toPartyRoles(
  records: NormalizedRegistryRecord[],
  observations: ObservationRow[],
  datasetReleaseId: string,
) {
  const recordsByRole = groupBy(
    records,
    (record) => `${partyKey(record.countryCode, record.partyId)}:${record.role}`,
  );
  const observationsByRole = groupBy(
    observations,
    (observation) => `${observation.party_key}:${observation.role}`,
  );
  return [...recordsByRole.entries()]
    .map<PartyRoleRow>(([key, roleRecords]) => {
      const [role] = key.split(":").slice(-1) as [RegistryRole];
      return {
        party_key: key.slice(0, -role.length - 1),
        role,
        consolidated_status: derivePartyStatus(roleRecords),
        highest_authority_level: "AUTHORITATIVE",
        observation_count: observationsByRole.get(key)?.length ?? 0,
        has_conflict: 0,
        dataset_release_id: datasetReleaseId,
      };
    })
    .sort((a, b) => a.party_key.localeCompare(b.party_key) || a.role.localeCompare(b.role));
}

function toSources(sources: SourceSummary[], datasetReleaseId: string) {
  return sources
    .map<SourceRow>((source) => ({
      id: source.id,
      name: source.name,
      authority_name: source.authorityName,
      authority_level: source.official ? "AUTHORITATIVE" : "SECONDARY",
      observation_type: source.official ? "OFFICIAL_ASSIGNMENT" : "OFFICIAL_DIRECTORY_ENTRY",
      official: source.official ? 1 : 0,
      homepage_url: source.homepageUrl,
      registry_url: source.registryUrl,
      jurisdictions_json: stableJson(source.jurisdictions),
      license_status: source.license.status,
      license_name: source.license.name,
      license_url: source.license.url,
      health_status: source.health.stale ? "stale" : source.enabled ? "current" : "disabled",
      record_count: source.health.recordCount,
      last_attempted_at: source.health.lastAttemptedRetrieval,
      last_successful_at: source.health.lastSuccessfulRetrieval,
      last_changed_at: null,
      freshness_status: source.health.freshness,
      latest_error_summary: source.health.latestErrorSummary,
      source_checksum: source.health.checksum,
      dataset_release_id: datasetReleaseId,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function toConflicts(
  report: ConflictReport,
  records: NormalizedRegistryRecord[],
  datasetReleaseId: string,
) {
  const byKey = new Map(records.map((record) => [record.key, record]));
  return (report.conflicts ?? [])
    .flatMap<ConflictRow>((conflict) => {
      const official = conflict.officialKey ? byKey.get(conflict.officialKey) : null;
      if (!official) return [];
      return [
        {
          key: conflict.observationKey,
          party_key: partyKey(official.countryCode, official.partyId),
          role: official.role,
          conflict_type: conflict.category,
          severity: conflict.category.includes("MISMATCH") ? "HIGH" : "MEDIUM",
          summary: conflict.message,
          details_json: stableJson(conflict),
          source_ids_json: stableJson([official.source.registryId, conflict.sourceId].sort()),
          detected_at: report.generatedAt ?? deterministicImportTimestamp,
          dataset_release_id: datasetReleaseId,
        },
      ];
    })
    .sort((a, b) => a.key.localeCompare(b.key));
}

function toImportSql(bundle: ImportBundle) {
  const statements = [
    "DELETE FROM active_dataset;",
    "DELETE FROM conflicts;",
    "DELETE FROM observations;",
    "DELETE FROM party_roles;",
    "DELETE FROM parties;",
    "DELETE FROM sources;",
    "DELETE FROM dataset_releases;",
    ...insertMany("dataset_releases", [bundle.release]),
    ...insertMany("sources", bundle.sources),
    ...insertMany("parties", bundle.parties),
    ...insertMany("party_roles", bundle.partyRoles),
    ...insertMany("observations", bundle.observations),
    ...insertMany("conflicts", bundle.conflicts),
    "INSERT INTO active_dataset (singleton, dataset_release_id) VALUES (1, " +
      sqlValue(bundle.release.id) +
      ") ON CONFLICT(singleton) DO UPDATE SET dataset_release_id = excluded.dataset_release_id;",
  ];
  return `${statements.join("\n")}\n`;
}

function insertMany<T extends object>(table: string, rows: T[]) {
  if (rows.length === 0) return [];
  const columns = Object.keys(rows[0] ?? {}) as Array<keyof T>;
  const chunks: string[] = [];
  for (let index = 0; index < rows.length; index += 50) {
    const chunk = rows.slice(index, index + 50);
    chunks.push(
      `INSERT INTO ${table} (${columns.join(", ")}) VALUES\n${chunk
        .map(
          (row) => `(${columns.map((column) => sqlValue(toSqlPrimitive(row[column]))).join(", ")})`,
        )
        .join(",\n")};`,
    );
  }
  return chunks;
}

function sqlValue(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "1" : "0";
  return `'${value.replaceAll("'", "''")}'`;
}

function toSqlPrimitive(value: unknown): string | number | boolean | null {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  throw new Error(`Unsupported SQL value: ${JSON.stringify(value)}`);
}

function selectPreferredRecord(records: NormalizedRegistryRecord[]) {
  return [...records].sort(
    (a, b) =>
      statusRank(b.status) - statusRank(a.status) ||
      b.source.retrievedAt.localeCompare(a.source.retrievedAt) ||
      a.source.registryId.localeCompare(b.source.registryId) ||
      a.role.localeCompare(b.role),
  )[0] as NormalizedRegistryRecord;
}

function derivePartyStatus(records: NormalizedRegistryRecord[]): RegistryStatus {
  const statuses = new Set(records.map((record) => record.status));
  if (statuses.has("ACTIVE")) return "ACTIVE";
  if (statuses.size === 1 && statuses.has("REVOKED")) return "REVOKED";
  if (statuses.size === 1 && statuses.has("INACTIVE")) return "INACTIVE";
  if (statuses.size === 1 && statuses.has("RESERVED")) return "RESERVED";
  return "UNKNOWN";
}

function statusRank(status: RegistryStatus) {
  return { ACTIVE: 5, RESERVED: 4, INACTIVE: 3, UNKNOWN: 2, REVOKED: 1 }[status];
}

function schemeForRole(role: RegistryRole) {
  return role === "EMSP"
    ? "EMI3_PROVIDER_ID"
    : role === "CPO" || role === "CSO"
      ? "EMI3_OPERATOR_ID"
      : "UNKNOWN";
}

function partyKey(countryCode: string, partyId: string) {
  return `${countryCode}:${partyId}`;
}

function normalizeSearchText(value: string | null) {
  return (value ?? "")
    .normalize("NFKD")
    .replaceAll(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replaceAll(/\s+/g, " ")
    .trim();
}

function minIso(values: string[]) {
  return [...values].sort()[0] ?? deterministicImportTimestamp;
}

function maxIso(values: string[]) {
  return [...values].sort().at(-1) ?? deterministicImportTimestamp;
}

function groupBy<T>(values: T[], keyOf: (value: T) => string) {
  const groups = new Map<string, T[]>();
  for (const value of values) {
    const key = keyOf(value);
    groups.set(key, [...(groups.get(key) ?? []), value]);
  }
  return groups;
}

function toNdjson(rows: unknown[]) {
  return rows.map((row) => stableJson(row)).join("\n") + (rows.length > 0 ? "\n" : "");
}

function countRows(fileName: string, body: string) {
  return fileName.endsWith(".ndjson") ? countNdjsonRows(body) : 1;
}

function countNdjsonRows(body: string) {
  return body.trim() === "" ? 0 : body.trim().split("\n").length;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function readJson(path: string) {
  return JSON.parse(await readFile(resolve(rootDir, path), "utf8")) as unknown;
}

async function readOptionalJson(path: string, fallback: unknown) {
  try {
    return await readJson(path);
  } catch {
    return fallback;
  }
}

function git(args: string[]) {
  return execFileSync("git", args, { cwd: rootDir, encoding: "utf8" }).trim();
}
