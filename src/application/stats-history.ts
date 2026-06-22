import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fromRoot } from "../infrastructure/filesystem/paths.js";
import type { NormalizedRegistryRecord } from "../domain/registry-record.js";
import type { GeneratedStats } from "../infrastructure/serialization/serializers.js";

export interface CountryRoleHistoryRow {
  date: string;
  countryCode: string;
  cpo: number;
  emsp: number;
  total: number;
  generatedAt: string;
  staleSources: string[];
}

const countryRoleHistoryHeader = [
  "date",
  "countryCode",
  "cpo",
  "emsp",
  "total",
  "generatedAt",
  "staleSources",
];

export async function updateCountryRoleHistory(
  historyPath = fromRoot("data", "history", "country-role-counts.csv"),
) {
  const [registryRaw, statsRaw] = await Promise.all([
    readFile(fromRoot("data", "registry.json"), "utf8"),
    readFile(fromRoot("data", "stats.json"), "utf8"),
  ]);
  const records = JSON.parse(registryRaw) as NormalizedRegistryRecord[];
  const stats = JSON.parse(statsRaw) as GeneratedStats;
  const rows = buildCountryRoleHistoryRows(records, stats);
  const existing = await readCountryRoleHistory(historyPath);
  const merged = upsertCountryRoleHistoryRows(existing, rows);

  await mkdir(dirname(historyPath), { recursive: true });
  await writeFile(historyPath, toCountryRoleHistoryCsv(merged));
  return rows;
}

export function buildCountryRoleHistoryRows(
  records: NormalizedRegistryRecord[],
  stats: Pick<GeneratedStats, "generatedAt" | "staleSources">,
): CountryRoleHistoryRow[] {
  const date = stats.generatedAt.slice(0, 10);
  const counts = new Map<string, { cpo: number; emsp: number; total: number }>();
  for (const record of records) {
    const countryCounts = counts.get(record.countryCode) ?? { cpo: 0, emsp: 0, total: 0 };
    if (record.role === "CPO") countryCounts.cpo += 1;
    if (record.role === "EMSP") countryCounts.emsp += 1;
    countryCounts.total += 1;
    counts.set(record.countryCode, countryCounts);
  }

  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([countryCode, count]) => ({
      date,
      countryCode,
      cpo: count.cpo,
      emsp: count.emsp,
      total: count.total,
      generatedAt: stats.generatedAt,
      staleSources: [...stats.staleSources].sort(),
    }));
}

export function upsertCountryRoleHistoryRows(
  existing: CountryRoleHistoryRow[],
  current: CountryRoleHistoryRow[],
) {
  const currentKeys = new Set(current.map((row) => historyKey(row)));
  return [...existing.filter((row) => !currentKeys.has(historyKey(row))), ...current].sort(
    (a, b) => a.date.localeCompare(b.date) || a.countryCode.localeCompare(b.countryCode),
  );
}

export async function readCountryRoleHistory(path: string) {
  try {
    return parseCountryRoleHistoryCsv(await readFile(path, "utf8"));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
}

export function parseCountryRoleHistoryCsv(csv: string): CountryRoleHistoryRow[] {
  const lines = csv.trim().split("\n");
  if (lines.length === 0 || lines[0] !== countryRoleHistoryHeader.join(",")) return [];
  const rows: CountryRoleHistoryRow[] = [];
  for (const line of lines.slice(1)) {
    const [date, countryCode, cpo, emsp, total, generatedAt, staleSources] = line.split(",");
    if (!date || !countryCode || !generatedAt) continue;
    rows.push({
      date,
      countryCode,
      cpo: Number(cpo),
      emsp: Number(emsp),
      total: Number(total),
      generatedAt,
      staleSources: staleSources ? staleSources.split(";").filter(Boolean) : [],
    });
  }
  return rows;
}

export function toCountryRoleHistoryCsv(rows: CountryRoleHistoryRow[]) {
  return (
    [
      countryRoleHistoryHeader.join(","),
      ...rows.map((row) =>
        [
          row.date,
          row.countryCode,
          String(row.cpo),
          String(row.emsp),
          String(row.total),
          row.generatedAt,
          row.staleSources.join(";"),
        ].join(","),
      ),
    ].join("\n") + "\n"
  );
}

function historyKey(row: Pick<CountryRoleHistoryRow, "date" | "countryCode">) {
  return `${row.date}:${row.countryCode}`;
}
