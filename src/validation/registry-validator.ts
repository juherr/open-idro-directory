import {
  normalizedRegistryRecordSchema,
  type NormalizedRegistryRecord,
} from "../domain/registry-record.js";
import { sourceJurisdictions, type SourceDefinition } from "../domain/source-definition.js";
import type { ValidationIssue } from "../domain/validation-issue.js";
import { validateRecord } from "./identifier-validator.js";

export function validateRegistry(
  records: NormalizedRegistryRecord[],
  sources: SourceDefinition[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const keys = new Map<string, NormalizedRegistryRecord>();
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  for (const record of records) {
    const schema = normalizedRegistryRecordSchema.safeParse(record);
    if (!schema.success) {
      issues.push({
        severity: "error",
        code: "SCHEMA_ERROR",
        recordKey: record.key,
        message: schema.error.message,
      });
    }
    issues.push(...validateRecord(record));
    const existing = keys.get(record.key);
    if (existing) {
      issues.push({
        severity: "error",
        code: "DUPLICATE_KEY",
        recordKey: record.key,
        message: `Duplicate key ${record.key}`,
      });
    } else {
      keys.set(record.key, record);
    }
    const source = sourceById.get(record.source.registryId);
    const mismatch = source && jurisdictionMismatch(record, source);
    if (mismatch) {
      issues.push({
        severity: "error",
        code: "JURISDICTION_MISMATCH",
        recordKey: record.key,
        message: mismatch,
      });
    }
  }
  const activeById = new Map<string, NormalizedRegistryRecord>();
  for (const record of records.filter((candidate) => candidate.status === "ACTIVE")) {
    const key = `${record.source.registryId}:${record.countryCode}:${record.partyId}:${record.role}`;
    const existing = activeById.get(key);
    if (existing && existing.organization.name !== record.organization.name) {
      issues.push({
        severity: "error",
        code: "CONFLICTING_ACTIVE_IDENTIFIER",
        recordKey: record.key,
        message: `${key} has conflicting active organizations.`,
      });
    }
    activeById.set(key, record);
  }
  return issues;
}

/**
 * A register may list another country's identifier, as a non-official
 * cross-register listing. It may not claim it as official, nor carry an
 * observation block that contradicts its jurisdictions. Records without a block
 * predate it: only their `official` flag is checked.
 */
function jurisdictionMismatch(record: NormalizedRegistryRecord, source: SourceDefinition) {
  const covered = sourceJurisdictions(source).includes(record.countryCode);
  const declared = record.source.observation?.kind;
  if (!covered && record.source.official) {
    return `${record.countryCode} is not declared for ${source.id}, so its record cannot be official`;
  }
  if (!covered && declared === "ASSIGNMENT") {
    return `${record.countryCode} is not declared for ${source.id}, so it cannot be an assignment`;
  }
  if (covered && declared === "CROSS_REGISTER_LISTING") {
    return `${record.countryCode} is declared for ${source.id}, so it cannot be a cross-register listing`;
  }
  return null;
}
