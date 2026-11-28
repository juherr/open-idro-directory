import { describe, expect, it } from "vitest";
import {
  issuingHealthBySourceId,
  issuingSourceHealth,
} from "../../src/application/issuing-source-health.js";
import type { SourceBuildResult } from "../../src/domain/source-result.js";

const RUN = "2026-06-15T00:00:00.000Z";
const EARLIER = "2026-06-14T00:00:00.000Z";

describe("issuingSourceHealth", () => {
  it.each([
    {
      case: "fetched and ingested",
      result: { stale: false, retrievedAt: RUN, lastSuccessfulRetrieval: RUN },
      expected: "CURRENT",
    },
    {
      case: "carried with its published current health",
      result: { stale: false, retrievedAt: EARLIER, lastSuccessfulRetrieval: EARLIER },
      expected: "CURRENT",
    },
    {
      // A carried source with no published health falls back to `stale: false`;
      // reading it as current would turn every foreign listing into NOT_FOUND.
      case: "never retrieved",
      result: { stale: false, retrievedAt: null, lastSuccessfulRetrieval: null },
      expected: "UNAVAILABLE",
    },
    {
      case: "fetch or build failed",
      result: { stale: true, retrievedAt: RUN, lastSuccessfulRetrieval: EARLIER },
      expected: "UNAVAILABLE",
    },
    {
      case: "failed and never retrieved before",
      result: { stale: true, retrievedAt: RUN, lastSuccessfulRetrieval: null },
      expected: "UNAVAILABLE",
    },
    {
      case: "answered but not ingested (safety thresholds)",
      result: { stale: true, retrievedAt: RUN, lastSuccessfulRetrieval: RUN },
      expected: "STALE",
    },
  ] as const)("reads $case as $expected", ({ result, expected }) => {
    expect(issuingSourceHealth(buildResult("dk-fstyr", result))).toBe(expected);
  });

  it("maps every result by source id", () => {
    expect(
      issuingHealthBySourceId([
        buildResult("dk-fstyr", { stale: false, retrievedAt: RUN, lastSuccessfulRetrieval: RUN }),
        buildResult("se-energimyndigheten", {
          stale: true,
          retrievedAt: RUN,
          lastSuccessfulRetrieval: RUN,
        }),
      ]),
    ).toEqual({ "dk-fstyr": "CURRENT", "se-energimyndigheten": "STALE" });
  });
});

function buildResult(
  sourceId: string,
  health: Pick<SourceBuildResult, "stale" | "retrievedAt" | "lastSuccessfulRetrieval">,
): SourceBuildResult {
  return {
    sourceId,
    records: [],
    warnings: [],
    errors: [],
    checksum: null,
    latestError: null,
    ...health,
  };
}
