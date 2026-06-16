import type { NormalizedRegistryRecord } from "../domain/registry-record.js";

export function applyOfficialStatusPolicy(records: NormalizedRegistryRecord[]) {
  const countriesWithOfficialRecords = new Set(
    records.filter((record) => record.source.official).map((record) => record.countryCode),
  );

  return records.map((record) => {
    if (
      record.status !== "ACTIVE" ||
      record.source.official ||
      !countriesWithOfficialRecords.has(record.countryCode)
    ) {
      return record;
    }

    return {
      ...record,
      status: "UNKNOWN" as const,
      metadata: {
        ...record.metadata,
        statusPolicy: "unknown-non-official-country-with-official-idro",
      },
    };
  });
}
