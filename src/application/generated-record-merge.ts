import type { NormalizedRegistryRecord } from "../domain/registry-record.js";
import type { SourceDefinition } from "../domain/source-definition.js";

const INACTIVE_REASON = "missing-from-official-source";

export function mergeGeneratedRecords(
  source: SourceDefinition,
  previous: NormalizedRegistryRecord[],
  current: NormalizedRegistryRecord[],
  retrievedAt: string,
) {
  if (!source.official) return current;

  const previousByKey = new Map(previous.map((record) => [record.key, record]));
  const currentKeys = new Set(current.map((record) => record.key));
  const records = current.map((record) => {
    const previousRecord = previousByKey.get(record.key);
    if (!previousRecord) return record;

    const { inactiveSince, inactiveReason, ...metadata } = previousRecord.metadata;
    void inactiveSince;
    void inactiveReason;

    return {
      ...record,
      status: "ACTIVE" as const,
      source: {
        ...record.source,
        firstSeenAt: previousRecord.source.firstSeenAt,
        lastSeenAt: record.source.lastSeenAt,
        retrievedAt,
      },
      metadata: {
        ...metadata,
        ...record.metadata,
      },
    };
  });

  for (const previousRecord of previous) {
    if (currentKeys.has(previousRecord.key)) continue;

    records.push({
      ...previousRecord,
      status: "INACTIVE" as const,
      source: {
        ...previousRecord.source,
        retrievedAt,
      },
      metadata: {
        ...previousRecord.metadata,
        inactiveSince:
          typeof previousRecord.metadata.inactiveSince === "string"
            ? previousRecord.metadata.inactiveSince
            : retrievedAt,
        inactiveReason: INACTIVE_REASON,
      },
    });
  }

  return records;
}
