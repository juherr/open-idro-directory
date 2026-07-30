import { describe, expect, it } from "vitest";
import { mergeInvalidRecordHistory } from "../../src/application/invalid-record-history.js";
import type { NormalizedRegistryRecord } from "../../src/domain/registry-record.js";

const FIRST_RUN = "2026-06-16T00:00:00.000Z";
const SECOND_RUN = "2026-07-27T00:00:00.000Z";

describe("invalid record history", () => {
  it("stamps a newly detected record with the current run", () => {
    const history = mergeInvalidRecordHistory(
      null,
      { records: [detection("WXYZ")], rows: [] },
      FIRST_RUN,
    );

    expect(history.records).toEqual([
      {
        reasons: ["INVALID_PARTY_ID"],
        firstDetectedAt: FIRST_RUN,
        lastDetectedAt: FIRST_RUN,
        supersededBy: null,
        record: sampleRecord("WXYZ"),
      },
    ]);
  });

  it("keeps the first detection and the hand-written correction when re-detected", () => {
    const previous = mergeInvalidRecordHistory(
      null,
      { records: [detection("WXYZ")], rows: [] },
      FIRST_RUN,
    );
    // Stands in for a maintainer editing the file.
    previous.records[0]!.supersededBy = "SEQRS";

    const history = mergeInvalidRecordHistory(
      previous,
      { records: [detection("WXYZ")], rows: [] },
      SECOND_RUN,
    );

    expect(history.records[0]).toMatchObject({
      firstDetectedAt: FIRST_RUN,
      lastDetectedAt: SECOND_RUN,
      supersededBy: "SEQRS",
    });
  });

  it("keeps entries the sources have stopped publishing", () => {
    const previous = mergeInvalidRecordHistory(
      null,
      { records: [detection("WXYZ")], rows: [] },
      FIRST_RUN,
    );

    const history = mergeInvalidRecordHistory(previous, { records: [], rows: [] }, SECOND_RUN);

    expect(history.records).toHaveLength(1);
    expect(history.records[0]).toMatchObject({
      firstDetectedAt: FIRST_RUN,
      lastDetectedAt: FIRST_RUN,
    });
    expect(history.generatedAt).toBe(SECOND_RUN);
  });

  it("accumulates rejected rows the same way", () => {
    const previous = mergeInvalidRecordHistory(
      null,
      { records: [], rows: [row("SEWXYZ")] },
      FIRST_RUN,
    );
    previous.rows[0]!.supersededBy = "SEQRS";

    const history = mergeInvalidRecordHistory(
      previous,
      { records: [], rows: [row("SEWXYZ"), row("SETUVW")] },
      SECOND_RUN,
    );

    expect(history.rows).toHaveLength(2);
    expect(history.rows.find((entry) => entry.sourceValue === "SEWXYZ")).toMatchObject({
      firstDetectedAt: FIRST_RUN,
      lastDetectedAt: SECOND_RUN,
      supersededBy: "SEQRS",
    });
    expect(history.rows.find((entry) => entry.sourceValue === "SETUVW")).toMatchObject({
      firstDetectedAt: SECOND_RUN,
      supersededBy: null,
    });
  });

  it("refreshes the stored record so the entry reflects the latest snapshot", () => {
    const previous = mergeInvalidRecordHistory(
      null,
      { records: [detection("WXYZ")], rows: [] },
      FIRST_RUN,
    );
    const renamed = detection("WXYZ");
    renamed.record.organization.name = "Example Operator AB";

    const history = mergeInvalidRecordHistory(
      previous,
      { records: [renamed], rows: [] },
      SECOND_RUN,
    );

    expect(history.records[0]?.record.organization.name).toBe("Example Operator AB");
  });

  it("rejects a hand-written correction that is not a valid eMobility ID", () => {
    const previous = mergeInvalidRecordHistory(
      null,
      { records: [detection("WXYZ")], rows: [] },
      FIRST_RUN,
    );
    previous.records[0]!.supersededBy = "SE-ALL";

    expect(() =>
      mergeInvalidRecordHistory(previous, { records: [], rows: [] }, SECOND_RUN),
    ).toThrow("SE-ALL");
  });

  it("sorts records and rows deterministically", () => {
    const history = mergeInvalidRecordHistory(
      null,
      {
        records: [detection("WXYZ"), detection("TUVW")],
        rows: [row("SEWXYZ"), row("SETUVW")],
      },
      FIRST_RUN,
    );

    expect(history.records.map((entry) => entry.record.partyId)).toEqual(["TUVW", "WXYZ"]);
    expect(history.rows.map((entry) => entry.sourceValue)).toEqual(["SETUVW", "SEWXYZ"]);
  });
});

function detection(partyId: string) {
  return { reasons: ["INVALID_PARTY_ID" as const], record: sampleRecord(partyId) };
}

function row(sourceValue: string) {
  return {
    registryId: "se-energimyndigheten",
    code: "ENERGIMYNDIGHETEN_MALFORMED_IDENTIFIER",
    sourceValue,
    message: `Unexpected identifier syntax: ${sourceValue}`,
  };
}

function sampleRecord(partyId: string): NormalizedRegistryRecord {
  return {
    key: `se-energimyndigheten:SE:${partyId}:CPO`,
    countryCode: "SE",
    partyId,
    eMobilityId: `SE${partyId}`,
    role: "CPO",
    status: "INACTIVE",
    organization: { name: "Example Operator", legalName: "Example Operator", website: null },
    source: {
      registryId: "se-energimyndigheten",
      official: true,
      sourceRecordId: `SE${partyId}`,
      sourceUrl: "https://www.energimyndigheten.se/",
      sourceValue: `SE${partyId}`,
      firstSeenAt: FIRST_RUN,
      lastSeenAt: FIRST_RUN,
      retrievedAt: FIRST_RUN,
    },
    metadata: {},
  };
}
