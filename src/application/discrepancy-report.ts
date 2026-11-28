import {
  identifierRoleKey,
  type IssuingConfirmation,
  type SourceHealthState,
} from "../domain/identifier-provenance.js";
import type {
  InvalidRegistryHistory,
  NormalizedRegistryRecord,
  RegistryRole,
  RegistryStatus,
} from "../domain/registry-record.js";
import { observationOf } from "../domain/registry-observation.js";
import {
  isAuthoritative,
  sourceJurisdictions,
  type SourceDefinition,
} from "../domain/source-definition.js";

/** The categories, in the order findings and counts are listed. */
export const DISCREPANCY_CATEGORIES = [
  "NOT_FOUND_IN_ISSUING_REGISTER",
  "CONFLICTING_ROLE",
  "REMOVED_FROM_ISSUING_REGISTER",
  "ADDED_TO_ISSUING_REGISTER",
  "CONFLICTING_NAME",
  "CONFLICTING_STATUS",
  "ISSUING_REGISTER_UNVERIFIABLE",
  "OUTSIDE_ISSUING_REGISTER_SCOPE",
  "DUPLICATE_IDENTIFIER",
  "MALFORMED_IDENTIFIER",
  "SOURCE_STALE",
  "SOURCE_UNAVAILABLE",
] as const;
export type DiscrepancyCategory = (typeof DISCREPANCY_CATEGORIES)[number];

const SEVERITIES = ["high", "medium", "low", "info"] as const;
export type DiscrepancySeverity = (typeof SEVERITIES)[number];
export type DiscrepancyConfidence = "high" | "medium" | "low";

// Severity and confidence by category; the categories whose value depends on
// the sources involved override it where they are built.
const RATING: Record<DiscrepancyCategory, [DiscrepancySeverity, DiscrepancyConfidence]> = {
  NOT_FOUND_IN_ISSUING_REGISTER: ["high", "high"],
  CONFLICTING_ROLE: ["medium", "high"],
  REMOVED_FROM_ISSUING_REGISTER: ["medium", "high"],
  ADDED_TO_ISSUING_REGISTER: ["info", "high"],
  CONFLICTING_NAME: ["low", "medium"],
  CONFLICTING_STATUS: ["medium", "high"],
  ISSUING_REGISTER_UNVERIFIABLE: ["info", "low"],
  OUTSIDE_ISSUING_REGISTER_SCOPE: ["info", "high"],
  DUPLICATE_IDENTIFIER: ["low", "high"],
  MALFORMED_IDENTIFIER: ["low", "high"],
  SOURCE_STALE: ["medium", "high"],
  SOURCE_UNAVAILABLE: ["medium", "high"],
};

const REMOVAL_REASON = "missing-from-official-source";

export interface DiscrepancySourceHealth {
  state: SourceHealthState;
  lastSuccessfulRetrieval: string | null;
}

/** A duplicate-identifier warning a source raised in its latest build. */
export interface DuplicateObservation {
  sourceId: string;
  code: string;
  message: string;
  retrievedAt: string | null;
}

export interface DiscrepancyEvidence {
  recordKey: string | null;
  registryId: string;
  retrievedAt: string | null;
  lastSeenAt: string | null;
  firstSeenAt?: string;
  role?: RegistryRole;
  status?: RegistryStatus;
  organizationName?: string;
  sourceValue?: string;
  healthState?: SourceHealthState;
  recordCount?: number;
  firstDetectedAt?: string;
  lastDetectedAt?: string;
  code?: string;
  message?: string;
}

export interface DiscrepancyFinding {
  category: DiscrepancyCategory;
  severity: DiscrepancySeverity;
  confidence: DiscrepancyConfidence;
  countryCode: string | null;
  issuingRegistryId: string | null;
  observedRegistryId: string;
  identifier: {
    countryCode: string;
    partyId: string;
    role: RegistryRole;
    eMobilityId: string;
  } | null;
  issuingConfirmation: IssuingConfirmation | null;
  reason?: string;
  summary: string;
  evidence: DiscrepancyEvidence[];
}

export interface DiscrepancyReport {
  generatedAt: string;
  summary: {
    totalFindings: number;
    byCategory: Record<DiscrepancyCategory, number>;
    bySeverity: Record<DiscrepancySeverity, number>;
  };
  countries: Array<{
    /** `null` for findings about a source that covers several countries. */
    countryCode: string | null;
    issuingRegistryIds: string[];
    pairs: Array<{
      issuingRegistryId: string | null;
      observedRegistryId: string;
      findings: DiscrepancyFinding[];
    }>;
  }>;
}

export interface DiscrepancyReportInput {
  /** The build's records, each with its `issuing` block. */
  records: readonly NormalizedRegistryRecord[];
  sources: readonly SourceDefinition[];
  /** Health by source id; a source missing from it counts as `UNAVAILABLE`. */
  health: Readonly<Record<string, DiscrepancySourceHealth>>;
  invalidHistory: Pick<InvalidRegistryHistory, "records" | "rows">;
  duplicates: readonly DuplicateObservation[];
  generatedAt: string;
}

type Draft = Omit<DiscrepancyFinding, "severity" | "confidence"> &
  Partial<Pick<DiscrepancyFinding, "severity" | "confidence">>;

/**
 * Compares what each issuing register publishes with what other sources
 * observe, for the issuing authorities to review. Findings are grouped by
 * country and by (issuing register, observed source) pair, and say what was
 * observed where: a difference is not a claim about the identifier's
 * standing. An issuing register that is stale or unavailable never yields a
 * removal or a not-found, only an unverifiable finding. Pure: the result
 * depends neither on the clock nor on the order of the inputs.
 */
export function buildDiscrepancyReport(input: DiscrepancyReportInput): DiscrepancyReport {
  const sourceById = new Map(input.sources.map((source) => [source.id, source]));
  const healthOf = (id: string): SourceHealthState =>
    sourceById.get(id)?.publication.enabled && Object.hasOwn(input.health, id)
      ? (input.health[id] as DiscrepancySourceHealth).state
      : "UNAVAILABLE";
  const registerEvidence = (id: string): DiscrepancyEvidence => ({
    recordKey: null,
    registryId: id,
    retrievedAt: input.health[id]?.lastSuccessfulRetrieval ?? null,
    lastSeenAt: null,
    healthState: healthOf(id),
  });
  // Mirrors the classifier: the authoritative sources covering the country,
  // narrowed to those publishing the role when `role` is given.
  const covering = (country: string, role?: RegistryRole) =>
    input.sources
      .filter(
        (source) =>
          isAuthoritative(source) &&
          sourceJurisdictions(source).includes(country) &&
          (role === undefined || source.registry.supportedRoles.includes(role)),
      )
      .map((source) => source.id)
      .sort(compare);
  const isIssuing = (record: NormalizedRegistryRecord) =>
    covering(record.countryCode, record.role).includes(record.source.registryId) &&
    observationOf(record, sourceById.get(record.source.registryId) as SourceDefinition).kind ===
      "ASSIGNMENT";

  const drafts: Draft[] = [];
  const known = input.records
    .filter((record) => sourceById.has(record.source.registryId))
    .sort((left, right) => compare(left.key, right.key));
  const presentIssuing = Map.groupBy(
    known.filter((record) => isPresent(record) && isIssuing(record)),
    (record) => `${record.countryCode}:${record.partyId}`,
  );
  const roleConflicts = new Map<string, Draft>();

  for (const group of Map.groupBy(known, identifierRoleKey).values()) {
    const first = group[0] as NormalizedRegistryRecord;
    const confirmation = first.issuing?.confirmation ?? null;
    const base = (record: NormalizedRegistryRecord) => ({
      countryCode: record.countryCode,
      identifier: identifierOf(record),
      issuingConfirmation: confirmation,
    });

    for (const record of group.filter(isIssuing)) {
      const id = record.source.registryId;
      const pair = { ...base(record), issuingRegistryId: id, observedRegistryId: id };
      if (isPresent(record) && record.source.firstSeenAt === record.source.retrievedAt) {
        drafts.push({
          ...pair,
          category: "ADDED_TO_ISSUING_REGISTER",
          summary: `${label(record)} is newly listed by the issuing register ${id}.`,
          evidence: [recordEvidence(record)],
        });
      }
      if (
        isPresent(record) ||
        record.metadata.inactiveReason !== REMOVAL_REASON ||
        confirmation === "CONFIRMED"
      ) {
        continue;
      }
      const state = healthOf(id);
      drafts.push(
        state === "CURRENT"
          ? {
              ...pair,
              category: "REMOVED_FROM_ISSUING_REGISTER",
              summary: `${label(record)} is no longer listed by the issuing register ${id}.`,
              evidence: [recordEvidence(record)],
            }
          : {
              ...pair,
              category: "ISSUING_REGISTER_UNVERIFIABLE",
              reason: `SOURCE_${state}`,
              summary: `${label(record)} no longer appears in ${id}, whose latest retrieval is not current.`,
              evidence: [recordEvidence(record), registerEvidence(id)],
            },
      );
    }

    const listings = group.filter((record) => isPresent(record) && !isIssuing(record));
    for (const listing of listings) {
      const observed = listing.source.registryId;
      const confidence = healthOf(observed) === "CURRENT" ? "high" : "medium";
      const toIssuer = (issuing: string | null) => ({
        ...base(listing),
        issuingRegistryId: issuing,
        observedRegistryId: observed,
      });
      const issuers = covering(listing.countryCode, listing.role);
      if (confirmation === "NOT_FOUND") {
        const identifierKey = `${listing.countryCode}:${listing.partyId}`;
        const otherRoles = (presentIssuing.get(identifierKey) ?? []).filter(
          (record) => record.role !== listing.role,
        );
        for (const issuerRecord of otherRoles) {
          const issuing = issuerRecord.source.registryId;
          const key = `${identifierKey}|${observed}|${issuing}`;
          const draft = roleConflicts.get(key) ?? {
            ...toIssuer(issuing),
            category: "CONFLICTING_ROLE",
            confidence,
            summary: `${listing.eMobilityId} is listed by ${observed} as ${listing.role}; the issuing register ${issuing} lists it under another role.`,
            evidence: [],
          };
          draft.evidence.push(recordEvidence(listing), recordEvidence(issuerRecord));
          roleConflicts.set(key, draft);
        }
        if (otherRoles.length > 0) continue;
        for (const issuing of issuers) {
          drafts.push({
            ...toIssuer(issuing),
            category: "NOT_FOUND_IN_ISSUING_REGISTER",
            confidence,
            summary: `${label(listing)} is listed by ${observed} and not found in the issuing register ${issuing}.`,
            evidence: [recordEvidence(listing), registerEvidence(issuing)],
          });
        }
      } else if (confirmation === "SOURCE_STALE" || confirmation === "SOURCE_UNAVAILABLE") {
        for (const issuing of issuers.filter((id) => healthOf(id) !== "CURRENT")) {
          drafts.push({
            ...toIssuer(issuing),
            category: "ISSUING_REGISTER_UNVERIFIABLE",
            reason: confirmation,
            summary: `${label(listing)} is listed by ${observed}; the issuing register ${issuing} could not be checked in its latest retrieval.`,
            evidence: [recordEvidence(listing), registerEvidence(issuing)],
          });
        }
      } else if (confirmation === "UNSUPPORTED_ROLE" || confirmation === "NO_ISSUING_SOURCE") {
        const outside = (issuing: string | null) => ({
          ...toIssuer(issuing),
          category: "OUTSIDE_ISSUING_REGISTER_SCOPE" as const,
          reason: issuing === null ? "NO_ISSUING_REGISTER" : "ROLE_NOT_PUBLISHED",
          summary:
            issuing === null
              ? `${label(listing)} is listed by ${observed}; no issuing register is tracked for ${listing.countryCode}.`
              : `${label(listing)} is listed by ${observed}; the issuing register ${issuing} does not publish this role.`,
          evidence: [recordEvidence(listing)],
        });
        const registers = covering(listing.countryCode);
        drafts.push(...(registers.length > 0 ? registers.map(outside) : [outside(null)]));
      }
    }

    const present = group.filter(isPresent);
    drafts.push(
      ...conflicts(present, isIssuing, sameName, (left, right) => ({
        ...base(left),
        category: "CONFLICTING_NAME",
        summary: `${label(left)} is published under different organisation names by ${left.source.registryId} and ${right.source.registryId}.`,
      })),
      ...conflicts(present, isIssuing, sameStatus, (left, right) => ({
        ...base(left),
        category: "CONFLICTING_STATUS",
        summary: `${label(left)} is published with different statuses by ${left.source.registryId} and ${right.source.registryId}.`,
      })),
    );
  }
  drafts.push(...roleConflicts.values());

  for (const source of input.sources) {
    const state = healthOf(source.id);
    if (!source.publication.enabled || state === "CURRENT") continue;
    const recordCount = input.records.filter(
      (record) => record.source.registryId === source.id,
    ).length;
    for (const country of [...new Set(sourceJurisdictions(source))].sort(compare)) {
      drafts.push({
        category: `SOURCE_${state}`,
        severity: isAuthoritative(source) ? "medium" : "low",
        countryCode: country,
        issuingRegistryId: isAuthoritative(source) ? source.id : null,
        observedRegistryId: source.id,
        identifier: null,
        issuingConfirmation: null,
        summary:
          state === "STALE"
            ? `${source.id} was not refreshed in the latest build; its last retrieval is kept.`
            : `${source.id} could not be retrieved in the latest build.`,
        evidence: [{ ...registerEvidence(source.id), recordCount }],
      });
    }
  }

  const sourceLevel = (registryId: string, country: string | null) => {
    const source = sourceById.get(registryId);
    const jurisdictions = source ? sourceJurisdictions(source) : [];
    const countryCode = country ?? (jurisdictions.length === 1 ? (jurisdictions[0] ?? null) : null);
    const issuing =
      source &&
      isAuthoritative(source) &&
      (countryCode === null || jurisdictions.includes(countryCode));
    return {
      countryCode,
      issuingRegistryId: issuing ? registryId : null,
      observedRegistryId: registryId,
    };
  };
  for (const duplicate of input.duplicates) {
    drafts.push({
      ...sourceLevel(duplicate.sourceId, null),
      category: "DUPLICATE_IDENTIFIER",
      identifier: null,
      issuingConfirmation: null,
      summary: `${duplicate.sourceId} publishes the same identifier more than once.`,
      evidence: [
        {
          recordKey: null,
          registryId: duplicate.sourceId,
          retrievedAt: duplicate.retrievedAt,
          lastSeenAt: null,
          code: duplicate.code,
          message: duplicate.message,
        },
      ],
    });
  }
  for (const entry of input.invalidHistory.records) {
    const { record } = entry;
    const countryUnread = entry.reasons.includes("INVALID_COUNTRY");
    drafts.push({
      ...sourceLevel(record.source.registryId, countryUnread ? null : record.countryCode),
      category: "MALFORMED_IDENTIFIER",
      identifier: identifierOf(record),
      issuingConfirmation: null,
      reason: countryUnread ? "COUNTRY_CODE_NOT_RECOGNISED" : "PARTY_ID_NOT_RECOGNISED",
      summary: `${record.source.registryId} publishes ${record.source.sourceValue}, which does not read as an eMI3 identifier.`,
      evidence: [
        {
          ...recordEvidence(record),
          firstDetectedAt: entry.firstDetectedAt,
          lastDetectedAt: entry.lastDetectedAt,
        },
      ],
    });
  }
  for (const row of input.invalidHistory.rows) {
    drafts.push({
      ...sourceLevel(row.registryId, null),
      category: "MALFORMED_IDENTIFIER",
      identifier: null,
      issuingConfirmation: null,
      reason: "IDENTIFIER_NOT_PARSEABLE",
      summary: `${row.registryId} publishes a value that cannot be read as a country code and a party ID.`,
      evidence: [
        {
          recordKey: null,
          registryId: row.registryId,
          retrievedAt: null,
          lastSeenAt: null,
          sourceValue: row.sourceValue,
          firstDetectedAt: row.firstDetectedAt,
          lastDetectedAt: row.lastDetectedAt,
        },
      ],
    });
  }

  return assemble(drafts, input.generatedAt, covering);
}

/** The duplicate warnings a report holds, as `buildDiscrepancyReport` takes them. */
export function readDuplicateFindings(report: DiscrepancyReport): DuplicateObservation[] {
  return report.countries
    .flatMap((country) => country.pairs.flatMap((pair) => pair.findings))
    .filter((finding) => finding.category === "DUPLICATE_IDENTIFIER")
    .flatMap((finding) =>
      finding.evidence.map((evidence) => ({
        sourceId: evidence.registryId,
        code: evidence.code ?? "",
        message: evidence.message ?? "",
        retrievedAt: evidence.retrievedAt,
      })),
    );
}

function assemble(
  drafts: Draft[],
  generatedAt: string,
  covering: (country: string) => string[],
): DiscrepancyReport {
  const findings: DiscrepancyFinding[] = drafts
    // Spelled out so that every finding lists its fields in the same order.
    .map((draft) => ({
      category: draft.category,
      severity: draft.severity ?? RATING[draft.category][0],
      confidence: draft.confidence ?? RATING[draft.category][1],
      countryCode: draft.countryCode,
      issuingRegistryId: draft.issuingRegistryId,
      observedRegistryId: draft.observedRegistryId,
      identifier: draft.identifier,
      issuingConfirmation: draft.issuingConfirmation,
      ...(draft.reason === undefined ? {} : { reason: draft.reason }),
      summary: draft.summary,
      evidence: uniqueEvidence(draft.evidence),
    }))
    .sort(compareFindings);

  const byCategory = Object.fromEntries(DISCREPANCY_CATEGORIES.map((key) => [key, 0])) as Record<
    DiscrepancyCategory,
    number
  >;
  const bySeverity = Object.fromEntries(SEVERITIES.map((key) => [key, 0])) as Record<
    DiscrepancySeverity,
    number
  >;
  for (const finding of findings) {
    byCategory[finding.category] += 1;
    bySeverity[finding.severity] += 1;
  }

  // `findings` is sorted by country then pair, which grouping keeps.
  const countries = [...Map.groupBy(findings, (finding) => finding.countryCode)].map(
    ([countryCode, entries]) => ({
      countryCode,
      issuingRegistryIds: countryCode === null ? [] : covering(countryCode),
      pairs: [
        ...Map.groupBy(
          entries,
          (finding) => `${finding.issuingRegistryId ?? ""}>${finding.observedRegistryId}`,
        ).values(),
      ].map((pairFindings) => {
        const { issuingRegistryId, observedRegistryId } = pairFindings[0] as DiscrepancyFinding;
        return { issuingRegistryId, observedRegistryId, findings: pairFindings };
      }),
    }),
  );
  return {
    generatedAt,
    summary: { totalFindings: findings.length, byCategory, bySeverity },
    countries,
  };
}

// One finding per pair whose values differ: each issuing record against every
// other record or, with no issuing record, the first register against the
// others.
function conflicts(
  present: NormalizedRegistryRecord[],
  isIssuing: (record: NormalizedRegistryRecord) => boolean,
  same: (left: NormalizedRegistryRecord, right: NormalizedRegistryRecord) => boolean,
  describe: (
    left: NormalizedRegistryRecord,
    right: NormalizedRegistryRecord,
  ) => Pick<Draft, "category" | "summary" | "countryCode" | "identifier" | "issuingConfirmation">,
): Draft[] {
  const issuing = present.filter(isIssuing);
  const [reference, ...rest] = present;
  const pairs =
    issuing.length > 0
      ? issuing.flatMap((left) =>
          present.filter((right) => !isIssuing(right)).map((right) => [left, right, true] as const),
        )
      : reference
        ? rest.map((right) => [reference, right, false] as const)
        : [];
  return pairs
    .filter(([left, right]) => !same(left, right))
    .map(([left, right, fromIssuer]) => ({
      ...describe(left, right),
      issuingRegistryId: fromIssuer ? left.source.registryId : null,
      observedRegistryId: right.source.registryId,
      evidence: [recordEvidence(left), recordEvidence(right)],
    }));
}

function sameName(left: NormalizedRegistryRecord, right: NormalizedRegistryRecord) {
  return normalizeName(left.organization.name) === normalizeName(right.organization.name);
}

function normalizeName(name: string) {
  return name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\p{P}\p{S}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Cross-register listings are all published `UNKNOWN`, which says nothing.
function sameStatus(left: NormalizedRegistryRecord, right: NormalizedRegistryRecord) {
  return left.status === right.status || left.status === "UNKNOWN" || right.status === "UNKNOWN";
}

// Present in the source's latest retrieval, as the classifier reads it.
function isPresent(record: NormalizedRegistryRecord) {
  return record.source.lastSeenAt === record.source.retrievedAt;
}

function identifierOf(record: NormalizedRegistryRecord) {
  return {
    countryCode: record.countryCode,
    partyId: record.partyId,
    role: record.role,
    eMobilityId: record.eMobilityId,
  };
}

function label(record: NormalizedRegistryRecord) {
  return `${record.eMobilityId} (${record.role})`;
}

function recordEvidence(record: NormalizedRegistryRecord): DiscrepancyEvidence {
  return {
    recordKey: record.key,
    registryId: record.source.registryId,
    retrievedAt: record.source.retrievedAt,
    lastSeenAt: record.source.lastSeenAt,
    firstSeenAt: record.source.firstSeenAt,
    role: record.role,
    status: record.status,
    organizationName: record.organization.name,
    sourceValue: record.source.sourceValue,
  };
}

function uniqueEvidence(evidence: DiscrepancyEvidence[]) {
  const byText = new Map(evidence.map((entry) => [JSON.stringify(entry), entry]));
  return [...byText]
    .sort(
      ([leftText, left], [rightText, right]) =>
        compare(left.registryId, right.registryId) ||
        compare(left.recordKey ?? "", right.recordKey ?? "") ||
        compare(leftText, rightText),
    )
    .map(([, entry]) => entry);
}

function compareFindings(left: DiscrepancyFinding, right: DiscrepancyFinding) {
  return (
    compareNullable(left.countryCode, right.countryCode) ||
    compareNullable(left.issuingRegistryId, right.issuingRegistryId) ||
    compare(left.observedRegistryId, right.observedRegistryId) ||
    DISCREPANCY_CATEGORIES.indexOf(left.category) -
      DISCREPANCY_CATEGORIES.indexOf(right.category) ||
    compare(identifierKey(left), identifierKey(right)) ||
    compare(JSON.stringify(left.evidence), JSON.stringify(right.evidence)) ||
    compare(left.summary, right.summary)
  );
}

function identifierKey(finding: DiscrepancyFinding) {
  return finding.identifier ? identifierRoleKey(finding.identifier) : "";
}

// `null` sorts last.
function compareNullable(left: string | null, right: string | null) {
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return compare(left, right);
}

function compare(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}
