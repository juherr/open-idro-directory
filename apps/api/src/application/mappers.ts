import { encodeCursor } from "../domain/cursor.js";
import { SOURCE_DISCLAIMER } from "../domain/constants.js";
import type {
  ConflictRow,
  DatasetRelease,
  ObservationRow,
  PartyRoleRow,
  PartyRow,
  SourceRow,
} from "../infrastructure/d1/types.js";

export function datasetPayload(release: DatasetRelease) {
  return {
    releaseId: release.id,
    gitCommitSha: release.git_commit_sha,
    gitRef: release.git_ref,
    schemaVersion: release.schema_version,
    checksum: release.dataset_checksum,
    recordCount: release.record_count,
    sourceCount: release.source_count,
    generatedAt: release.generated_at,
    importedAt: release.imported_at,
    importerVersion: release.importer_version,
    downloads: {
      registryJson: "data/registry.json",
      registryNdjson: "data/registry.ndjson",
      registryCsv: "data/registry.csv",
      sourcesJson: "data/sources.json",
      statsJson: "data/stats.json",
    },
  };
}

export function partyPayload(row: PartyRow, roles: PartyRoleRow[] = []) {
  return {
    key: row.key,
    countryCode: row.country_code,
    partyId: row.party_id,
    eMobilityId: row.emobility_id,
    preferredName: row.preferred_name,
    legalName: row.legal_name,
    website: row.website,
    status: row.consolidated_status,
    highestAuthorityLevel: row.highest_authority_level,
    roleCount: row.role_count,
    observationCount: row.observation_count,
    hasConflict: Boolean(row.has_conflict),
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    roles: roles.map((role) => ({
      role: role.role,
      status: role.consolidated_status,
      highestAuthorityLevel: role.highest_authority_level,
      observationCount: role.observation_count,
      hasConflict: Boolean(role.has_conflict),
    })),
  };
}

export function sourcePayload(row: SourceRow) {
  // Until the first import after migration 0004, sources.authority_id is NULL and
  // the authority join misses, so each field falls back to the source's own column.
  const authorityName = row.joined_authority_name ?? row.authority_name;
  const authorityLevel = row.joined_authority_level ?? row.authority_level;
  const homepageUrl = row.authority_homepage_url ?? row.homepage_url;
  const registryJurisdictions = parseJson<string[]>(row.jurisdictions_json);

  return {
    id: row.id,
    name: row.name,
    // The appointed organisation. Several sources may name the same authority.
    authority: {
      id: row.authority_id,
      name: authorityName,
      level: authorityLevel,
      jurisdictions: row.authority_jurisdictions_json
        ? parseJson<string[]>(row.authority_jurisdictions_json)
        : registryJurisdictions,
      homepageUrl,
      notes: row.authority_notes,
    },
    // The register that authority operates.
    registry: {
      url: row.registry_url,
      observationType: row.observation_type,
      jurisdictions: registryJurisdictions,
    },
    // The technical resource this project consumes.
    publication: {
      machineReadableUrl: row.machine_readable_url,
      verifiedAt: row.verified_at,
    },
    // Flat fields kept for consumers of API schema 1.1.x. Derived, not authoritative.
    authorityName,
    authorityLevel,
    observationType: row.observation_type,
    official: Boolean(row.official),
    homepageUrl,
    registryUrl: row.registry_url,
    machineReadableUrl: row.machine_readable_url,
    verifiedAt: row.verified_at,
    jurisdictions: registryJurisdictions,
    reuse: {
      status: row.reuse_status,
      legalBasis: reference(row.reuse_legal_basis_name, row.reuse_legal_basis_url),
      licence: reference(row.reuse_licence_name, row.reuse_licence_url),
      attributionNotice: row.reuse_attribution_notice,
      redistributionAllowed:
        row.reuse_redistribution_allowed === null
          ? null
          : Boolean(row.reuse_redistribution_allowed),
      notes: row.reuse_notes,
    },
    health: {
      status: row.health_status,
      freshness: row.freshness_status,
      recordCount: row.record_count,
      lastAttemptedAt: row.last_attempted_at,
      lastSuccessfulAt: row.last_successful_at,
      lastChangedAt: row.last_changed_at,
      latestErrorSummary: row.latest_error_summary,
      checksum: row.source_checksum,
    },
    disclaimer: SOURCE_DISCLAIMER,
  };
}

export function observationPayload(row: ObservationRow) {
  return {
    key: row.key,
    partyKey: row.party_key,
    sourceId: row.source_id,
    scheme: row.scheme,
    countryCode: row.country_code,
    partyId: row.party_id,
    eMobilityId: row.emobility_id,
    role: row.role,
    status: row.status,
    organizationName: row.organization_name,
    legalName: row.legal_name,
    website: row.website,
    sourceRecordId: row.source_record_id,
    sourceValue: row.source_value,
    sourceUrl: row.source_url,
    authorityLevel: row.authority_level,
    observationType: row.observation_type,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    retrievedAt: row.retrieved_at,
    metadata: parseJson<Record<string, unknown>>(row.metadata_json),
    rawRecordChecksum: row.raw_record_checksum,
  };
}

export function conflictPayload(row: ConflictRow) {
  return {
    key: row.key,
    partyKey: row.party_key,
    role: row.role,
    type: row.conflict_type,
    severity: row.severity,
    summary: row.summary,
    details: parseJson<unknown>(row.details_json),
    sourceIds: parseJson<string[]>(row.source_ids_json),
    detectedAt: row.detected_at,
  };
}

export function listPayload<T, C>(items: T[], nextCursor: string | null, mapper: (item: T) => C) {
  return {
    items: items.map(mapper),
    pagination: {
      nextCursor: nextCursor ? encodeCursor(JSON.parse(nextCursor) as never) : null,
    },
  };
}

export function countMap(rows: Array<{ key: string; count: number }>) {
  return Object.fromEntries(rows.map((row) => [row.key, row.count]));
}

function parseJson<T>(value: string) {
  return JSON.parse(value) as T;
}

function reference(name: string | null, url: string | null) {
  return name && url ? { name, url } : null;
}
