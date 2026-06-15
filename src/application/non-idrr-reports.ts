import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { IdentifierObservation, SourceAssessment } from "../domain/identifier-observation.js";
import type { NormalizedRegistryRecord } from "../domain/registry-record.js";
import type { SourceDefinition } from "../domain/source-definition.js";
import { fromRoot } from "../infrastructure/filesystem/paths.js";
import { validateObservations } from "../validation/observation-validator.js";

export type AdditionCategory =
  | "NEW_IDENTIFIER"
  | "NEW_SCHEME_FOR_KNOWN_PARTY"
  | "NEW_ALIAS"
  | "NEW_ROLE_OBSERVATION"
  | "NEW_NETWORK_MEMBERSHIP"
  | "HISTORICAL_ASSIGNMENT"
  | "INFRASTRUCTURE_USAGE";

export type ConflictCategory =
  | "IDENTIFIER_HOLDER_MISMATCH"
  | "ROLE_MISMATCH"
  | "STATUS_MISMATCH"
  | "SCHEME_AMBIGUITY"
  | "OFFICIAL_VS_SECONDARY_CONFLICT"
  | "OCPI_VS_EMI3_CONFUSION"
  | "STALE_SOURCE_CONFLICT";

export interface RejectedSource {
  sourceId: string;
  category: string;
  url: string;
  recommendation: "reject" | "defer" | "spike";
  reason: string;
  nextStep: string | null;
}

export interface SourceHealth {
  sourceId: string;
  enabled: boolean;
  authorityLevel: string | null;
  observationType: string | null;
  assessment: SourceAssessment | null;
  observationCount: number;
  status: "current" | "disabled" | "rejected" | "not-implemented";
}

export async function buildNonIdrrReports(
  sources: SourceDefinition[],
  observations: IdentifierObservation[] = [],
  generatedAt = new Date().toISOString(),
) {
  const payloads = await createNonIdrrReportPayloads(sources, observations, generatedAt);
  const reportsDir = fromRoot("data", "reports");
  await mkdir(reportsDir, { recursive: true });
  await writeJson("non-idrr-additions.json", payloads.additionsReport);
  await writeJson("non-idrr-conflicts.json", payloads.conflictsReport);
  await writeJson("non-idrr-overlap.json", payloads.overlapReport);
  await writeJson("source-health.json", payloads.sourceHealthReport);
  await writeJson("rejected-sources.json", payloads.rejectedSourcesReport);

  return {
    additions: payloads.additionsReport.additions,
    conflicts: payloads.conflictsReport.conflicts,
    overlap: payloads.overlapReport.overlap,
    sourceHealth: payloads.sourceHealthReport.sources,
    rejectedSources: payloads.rejectedSourcesReport.sources,
  };
}

export async function createNonIdrrReportPayloads(
  sources: SourceDefinition[],
  observations: IdentifierObservation[] = [],
  generatedAt = new Date().toISOString(),
  officialRecords?: NormalizedRegistryRecord[],
) {
  const issues = validateObservations(observations);
  const errors = issues.filter((issue) => issue.severity === "error");
  if (errors.length > 0) throw new Error(errors.map((issue) => issue.message).join("; "));

  const records = officialRecords ?? (await readOfficialRegistry());
  const officialByIdentifier = new Map(
    records.map((record) => [`${record.countryCode}:${record.partyId}:${record.role}`, record]),
  );
  const officialByParty = new Set(
    records.map((record) => `${record.countryCode}:${record.partyId}`),
  );

  const additions = observations
    .filter((observation) => !isOfficialOverlap(observation, officialByIdentifier))
    .map((observation) => ({
      category: categorizeAddition(observation, officialByParty),
      observationKey: observation.key,
      sourceId: observation.source.sourceId,
      scheme: observation.scheme,
      countryCode: observation.countryCode,
      partyId: observation.partyId,
      role: observation.role,
      confidence: observation.confidence.score,
    }));

  const overlap = observations
    .filter((observation) => isOfficialOverlap(observation, officialByIdentifier))
    .map((observation) => ({
      observationKey: observation.key,
      officialKey: officialByIdentifier.get(observationIdentity(observation))?.key ?? null,
      sourceId: observation.source.sourceId,
      scheme: observation.scheme,
      countryCode: observation.countryCode,
      partyId: observation.partyId,
      role: observation.role,
    }));

  const conflicts = observations
    .flatMap((observation) => detectConflicts(observation, officialByIdentifier))
    .sort((a, b) => a.observationKey.localeCompare(b.observationKey));

  const sourceHealth = buildSourceHealth(sources, observations);
  return {
    additionsReport: { generatedAt, additions },
    conflictsReport: { generatedAt, conflicts },
    overlapReport: { generatedAt, overlap },
    sourceHealthReport: { generatedAt, sources: sourceHealth },
    rejectedSourcesReport: { generatedAt, sources: defaultRejectedSources },
  };
}

function observationIdentity(observation: IdentifierObservation) {
  return `${observation.countryCode ?? ""}:${observation.partyId}:${observation.role}`;
}

function isOfficialOverlap(
  observation: IdentifierObservation,
  officialByIdentifier: Map<string, NormalizedRegistryRecord>,
) {
  return isEmi3Scheme(observation) && officialByIdentifier.has(observationIdentity(observation));
}

function isEmi3Scheme(observation: IdentifierObservation) {
  return observation.scheme === "EMI3_OPERATOR_ID" || observation.scheme === "EMI3_PROVIDER_ID";
}

function categorizeAddition(
  observation: IdentifierObservation,
  officialByParty: Set<string>,
): AdditionCategory {
  if (
    observation.countryCode &&
    officialByParty.has(`${observation.countryCode}:${observation.partyId}`) &&
    !isEmi3Scheme(observation)
  ) {
    return "NEW_SCHEME_FOR_KNOWN_PARTY";
  }
  if (observation.source.observationType === "LEGACY_ASSIGNMENT") return "HISTORICAL_ASSIGNMENT";
  if (observation.source.observationType === "NETWORK_REGISTRATION")
    return "NEW_NETWORK_MEMBERSHIP";
  if (observation.source.observationType === "INFRASTRUCTURE_OBSERVATION") {
    return "INFRASTRUCTURE_USAGE";
  }
  if (
    observation.countryCode &&
    officialByParty.has(`${observation.countryCode}:${observation.partyId}`)
  ) {
    return "NEW_ROLE_OBSERVATION";
  }
  return observation.scheme === "EMI3_OPERATOR_ID" || observation.scheme === "EMI3_PROVIDER_ID"
    ? "NEW_IDENTIFIER"
    : "NEW_SCHEME_FOR_KNOWN_PARTY";
}

function detectConflicts(
  observation: IdentifierObservation,
  officialByIdentifier: Map<string, NormalizedRegistryRecord>,
) {
  const official = officialByIdentifier.get(observationIdentity(observation));
  if (!official) return [];
  const conflicts: Array<{
    category: ConflictCategory;
    observationKey: string;
    officialKey: string;
    sourceId: string;
    message: string;
  }> = [];
  if (observation.scheme === "OCPI_PARTY_ID") {
    conflicts.push({
      category: "OCPI_VS_EMI3_CONFUSION",
      observationKey: observation.key,
      officialKey: official.key,
      sourceId: observation.source.sourceId,
      message:
        "OCPI party identifier matches an official eMI3 country/party/role tuple but must remain a separate scheme.",
    });
  } else if (!isEmi3Scheme(observation)) {
    conflicts.push({
      category: "SCHEME_AMBIGUITY",
      observationKey: observation.key,
      officialKey: official.key,
      sourceId: observation.source.sourceId,
      message: `${observation.scheme} matches an official eMI3 country/party/role tuple but must remain a separate scheme.`,
    });
  }
  const observedName = observation.organization.name;
  if (observedName && observedName !== official.organization.name) {
    conflicts.push({
      category: "IDENTIFIER_HOLDER_MISMATCH",
      observationKey: observation.key,
      officialKey: official.key,
      sourceId: observation.source.sourceId,
      message: `Observed holder ${observedName} differs from official holder ${official.organization.name}.`,
    });
  }
  if (observation.status !== official.status && observation.status !== "UNKNOWN") {
    conflicts.push({
      category: "STATUS_MISMATCH",
      observationKey: observation.key,
      officialKey: official.key,
      sourceId: observation.source.sourceId,
      message: `Observed status ${observation.status} differs from official status ${official.status}.`,
    });
  }
  return conflicts;
}

function buildSourceHealth(
  sources: SourceDefinition[],
  observations: IdentifierObservation[],
): SourceHealth[] {
  const counts = new Map<string, number>();
  for (const observation of observations) {
    counts.set(observation.source.sourceId, (counts.get(observation.source.sourceId) ?? 0) + 1);
  }
  return sources
    .map((source) => ({
      sourceId: source.id,
      enabled: source.enabled,
      authorityLevel: source.official ? "AUTHORITATIVE" : null,
      observationType: source.official ? "OFFICIAL_ASSIGNMENT" : null,
      assessment: null,
      observationCount: counts.get(source.id) ?? 0,
      status: source.enabled ? ("current" as const) : ("disabled" as const),
    }))
    .sort((a, b) => a.sourceId.localeCompare(b.sourceId));
}

async function readOfficialRegistry(): Promise<NormalizedRegistryRecord[]> {
  try {
    return JSON.parse(
      await readFile(fromRoot("data", "registry.json"), "utf8"),
    ) as NormalizedRegistryRecord[];
  } catch {
    return [];
  }
}

async function writeJson(fileName: string, body: unknown) {
  await writeFile(fromRoot("data", "reports", fileName), `${JSON.stringify(body, null, 2)}\n`);
}

const defaultRejectedSources: RejectedSource[] = [
  {
    sourceId: "ocn-registry",
    category: "ocn",
    url: "https://github.com/energywebfoundation/ocn-registry",
    recommendation: "spike",
    reason: "No current public production registry has been verified in this repository yet.",
    nextStep: "Complete docs/spikes/ocn-registry-assessment.md before enabling any connector.",
  },
  {
    sourceId: "authenticated-roaming-hubs",
    category: "roaming-network",
    url: "https://www.hubject.com/",
    recommendation: "defer",
    reason:
      "Partner portals and authenticated directories are out of scope without explicit access and redistribution rights.",
    nextStep: "Use docs/partnership-source-opportunities.md to request an explicit export.",
  },
];
