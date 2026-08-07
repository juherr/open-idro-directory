import { EMI3_IDENTIFIER_PATTERN } from "../domain/emi3-identifier.js";
import type {
  InvalidRegistryHistory,
  InvalidRegistryRecordDetection,
  InvalidRegistryRecordEntry,
  OutOfJurisdictionDetection,
  RejectedSourceRowDetection,
} from "../domain/registry-record.js";

export interface InvalidDetections {
  records: InvalidRegistryRecordDetection[];
  rows: RejectedSourceRowDetection[];
  outOfJurisdiction: OutOfJurisdictionDetection[];
}

/**
 * Accumulates what each build refused instead of replacing it.
 *
 * An identifier a source has corrected or dropped disappears from its own
 * registry, and with it any trace of the problem. Keeping the entry lets a
 * maintainer record the identifier that replaced it -- or show that nothing
 * did. `supersededBy` is written by hand in `data/registry-invalid.json` and is
 * carried over on every subsequent build.
 */
export function mergeInvalidRecordHistory(
  previous: InvalidRegistryHistory | null,
  detections: InvalidDetections,
  generatedAt: string,
): InvalidRegistryHistory {
  return {
    generatedAt,
    records: sortRecords(
      merge(previous?.records ?? [], detections.records, recordKey, generatedAt),
    ),
    rows: sortRows(merge(previous?.rows ?? [], detections.rows, rowKey, generatedAt)),
    // `previous` is parsed from a file that may predate this bucket.
    outOfJurisdiction: sortRows(
      merge(previous?.outOfJurisdiction ?? [], detections.outOfJurisdiction, rowKey, generatedAt),
    ),
  };
}

function merge<TDetection>(
  previous: (TDetection & HistoryFields)[],
  detections: TDetection[],
  keyOf: (item: TDetection) => string,
  generatedAt: string,
): (TDetection & HistoryFields)[] {
  const previousByKey = new Map(previous.map((entry) => [keyOf(entry), entry]));
  // A register can publish the same unreadable value more than once -- in a CPO
  // list and an EMSP list, or simply twice. It is one problem to fix, so the
  // history records it once.
  const unique = [
    ...new Map(detections.map((detection) => [keyOf(detection), detection])).values(),
  ];
  const merged = unique.map((detection) => {
    const existing = previousByKey.get(keyOf(detection));
    previousByKey.delete(keyOf(detection));
    return {
      ...detection,
      firstDetectedAt: existing?.firstDetectedAt ?? generatedAt,
      lastDetectedAt: generatedAt,
      supersededBy: checkedSupersededBy(existing),
    };
  });
  // Whatever was not detected this run stays exactly as it was.
  for (const entry of previousByKey.values()) {
    merged.push({ ...entry, supersededBy: checkedSupersededBy(entry) });
  }
  return merged;
}

function checkedSupersededBy(entry: HistoryFields | undefined) {
  const value = entry?.supersededBy ?? null;
  if (value !== null && !EMI3_IDENTIFIER_PATTERN.test(value)) {
    throw new Error(
      `Invalid supersededBy value ${value} in data/registry-invalid.json: expected an eMobility ID, two country letters followed by a three-character party ID.`,
    );
  }
  return value;
}

interface HistoryFields {
  firstDetectedAt: string;
  lastDetectedAt: string;
  supersededBy: string | null;
}

function recordKey(entry: InvalidRegistryRecordDetection) {
  return entry.record.key;
}

function rowKey(entry: RejectedSourceRowDetection) {
  return `${entry.registryId}:${entry.code}:${entry.sourceValue}`;
}

function sortRecords(entries: InvalidRegistryRecordEntry[]) {
  return [...entries].sort(
    (a, b) =>
      a.record.countryCode.localeCompare(b.record.countryCode) ||
      a.record.partyId.localeCompare(b.record.partyId) ||
      a.record.role.localeCompare(b.record.role) ||
      a.record.source.registryId.localeCompare(b.record.source.registryId),
  );
}

function sortRows<TRow extends { registryId: string; sourceValue: string; code: string }>(
  entries: TRow[],
) {
  return [...entries].sort(
    (a, b) =>
      a.registryId.localeCompare(b.registryId) ||
      a.sourceValue.localeCompare(b.sourceValue) ||
      a.code.localeCompare(b.code),
  );
}
