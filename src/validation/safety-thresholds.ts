import type { NormalizedRegistryRecord } from "../domain/registry-record.js";
import type { SourceDefinition } from "../domain/source-definition.js";
import type { ValidationIssue } from "../domain/validation-issue.js";

export function checkSafetyThresholds(
  source: SourceDefinition,
  previous: NormalizedRegistryRecord[],
  current: NormalizedRegistryRecord[],
  parseErrors: number,
  rawBody: string,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (previous.length > 0 && current.length === 0) {
    issues.push(error("SOURCE_BECAME_EMPTY", `${source.id} became empty.`));
  }
  const acceptedDeletionKeys = new Set(source.safety.acceptedDeletionKeys);
  const removed = previous.filter(
    (record) => !current.some((candidate) => candidate.key === record.key),
  );
  const unacceptedRemoved = removed.filter((record) => !acceptedDeletionKeys.has(record.key));
  const changed = current.filter((record) => {
    const old = previous.find((candidate) => candidate.key === record.key);
    return old && JSON.stringify(stableRecord(old)) !== JSON.stringify(stableRecord(record));
  });
  const deletionRatio = previous.length > 0 ? unacceptedRemoved.length / previous.length : 0;
  if (
    previous.length > 0 &&
    deletionRatio > source.safety.maxDeletionRatio &&
    unacceptedRemoved.length > source.safety.maxDeletionCount
  ) {
    issues.push(
      error(
        "MASS_DELETION",
        `${source.id} deletion safety threshold exceeded: ${unacceptedRemoved.length} of ${previous.length} active records disappeared (${formatPercent(deletionRatio)}). Allowed up to ${formatPercent(source.safety.maxDeletionRatio)} or ${source.safety.maxDeletionCount} records. If the removals are verified upstream changes, add the vanished keys to safety.acceptedDeletionKeys; otherwise inspect the source response and parser.`,
      ),
    );
  }
  if (previous.length > 0 && changed.length / previous.length > source.safety.maxChangeRatio) {
    issues.push(error("MASS_CHANGE", `${changed.length} of ${previous.length} records changed.`));
  }
  const totalRows = current.length + parseErrors;
  if (totalRows > 0 && parseErrors / totalRows > source.safety.maxParseErrorRatio) {
    issues.push(error("PARSE_ERROR_THRESHOLD", `${parseErrors} parse errors exceeded threshold.`));
  }
  if (looksLikeFallback(rawBody)) {
    issues.push(
      error(
        "SOURCE_FALLBACK_PAGE",
        `${source.id} response looks like a fallback or access-control page.`,
      ),
    );
  }
  return issues;
}

function stableRecord(record: NormalizedRegistryRecord) {
  return {
    ...record,
    source: {
      ...record.source,
      firstSeenAt: "",
      lastSeenAt: "",
      retrievedAt: "",
    },
  };
}

function looksLikeFallback(body: string) {
  const sample = body.slice(0, 5000).toLowerCase();
  return (
    sample.includes("captcha") ||
    sample.includes("cloudflare") ||
    sample.includes("please log in") ||
    sample.includes("please sign in") ||
    sample.includes("authentication required") ||
    sample.includes("access denied") ||
    sample.includes("forbidden") ||
    sample.includes("se connecter")
  );
}

function formatPercent(value: number) {
  return `${Math.round(value * 1000) / 10}%`;
}

function error(code: string, message: string): ValidationIssue {
  return { severity: "error", code, message };
}
