import type { SourceHealthState } from "../domain/identifier-provenance.js";
import type { SourceBuildResult } from "../domain/source-result.js";

/**
 * How the issuing-confirmation classifier reads a source's build result. A
 * carried source's result is built from its published health, so a partial
 * update reads the same state a full build published.
 *
 * - never retrieved: `UNAVAILABLE`, even when the result says `stale: false`,
 *   as a carried source with no published health does;
 * - not stale: `CURRENT`;
 * - stale, and its last success is not this attempt: `UNAVAILABLE` (the fetch
 *   or the build failed);
 * - stale otherwise: `STALE` (the registry answered, but the run was not
 *   ingested, e.g. a safety threshold tripped).
 */
export function issuingSourceHealth(
  result: Pick<SourceBuildResult, "stale" | "retrievedAt" | "lastSuccessfulRetrieval">,
): SourceHealthState {
  if (result.lastSuccessfulRetrieval === null) return "UNAVAILABLE";
  if (!result.stale) return "CURRENT";
  return result.lastSuccessfulRetrieval === result.retrievedAt ? "STALE" : "UNAVAILABLE";
}

export function issuingHealthBySourceId(
  results: readonly SourceBuildResult[],
): Record<string, SourceHealthState> {
  return Object.fromEntries(
    results.map((result) => [result.sourceId, issuingSourceHealth(result)]),
  );
}
