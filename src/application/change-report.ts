import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { NormalizedRegistryRecord } from "../domain/registry-record.js";
import { fromRoot } from "../infrastructure/filesystem/paths.js";

const execFileAsync = promisify(execFile);

export interface RegistryDiff {
  previous: number;
  current: number;
  added: NormalizedRegistryRecord[];
  updated: NormalizedRegistryRecord[];
  removed: NormalizedRegistryRecord[];
  unchanged: number;
}

export async function diffAgainstGit(sourceId?: string): Promise<RegistryDiff> {
  const current = filter(await readCurrent(), sourceId);
  const previous = filter(await readFromGit(), sourceId);
  return diffRecords(previous, current);
}

export function diffRecords(
  previous: NormalizedRegistryRecord[],
  current: NormalizedRegistryRecord[],
): RegistryDiff {
  const previousByKey = new Map(previous.map((record) => [record.key, record]));
  const currentByKey = new Map(current.map((record) => [record.key, record]));
  const added = current.filter((record) => !previousByKey.has(record.key));
  const removed = previous.filter((record) => !currentByKey.has(record.key));
  const updated = current.filter((record) => {
    const old = previousByKey.get(record.key);
    return old && JSON.stringify(stableRecord(old)) !== JSON.stringify(stableRecord(record));
  });
  return {
    previous: previous.length,
    current: current.length,
    added,
    updated,
    removed,
    unchanged: current.length - added.length - updated.length,
  };
}

// GitHub caps issue/PR bodies at 65,536 characters. Stay safely under it so the
// automation can use the PR-body report directly with `gh pr create/edit --body-file`.
const PR_BODY_MAX_CHARS = 60_000;
const REPORT_HEADING = "# Registry Change Summary";

/** What the run refused, across every source, as the history records it. */
export interface RunFindings {
  rows: { registryId: string; sourceValue: string }[];
  outOfJurisdiction: { registryId: string; sourceValue: string; countryCode: string }[];
}

/** What a source published that the run could not use, this run. */
export interface SourceFindings {
  unreadable: { sourceValue: string }[];
  outOfJurisdiction: { sourceValue: string; countryCode: string }[];
}

const NO_FINDINGS: SourceFindings = { unreadable: [], outOfJurisdiction: [] };

export interface ChangeReportEntry {
  sourceId: string;
  diff: RegistryDiff;
  findings?: SourceFindings;
}

export interface SourceFailure {
  sourceId: string;
  error: string;
}

export interface RenderedChangeReport {
  /** Full report: per-source counts plus the record-level tables. */
  full: string;
  /** PR-body report: counts only, no record-level tables, capped to GitHub's body limit. */
  prBody: string;
}

export async function writeChangeReport(
  sourceIds: string[],
  failures: SourceFailure[] = [],
  findings: RunFindings = { rows: [], outOfJurisdiction: [] },
) {
  const unreadableBySource = Map.groupBy(findings.rows, (row) => row.registryId);
  const foreignBySource = Map.groupBy(findings.outOfJurisdiction, (row) => row.registryId);
  await mkdir(fromRoot("build"), { recursive: true });
  // The registry weighs several megabytes and reading it from git spawns a
  // subprocess: load both sides once and diff each source from memory.
  const current = groupBySource(await readCurrent());
  const previous = groupBySource(await readFromGit());
  const entries: ChangeReportEntry[] = sourceIds.map((sourceId) => ({
    sourceId,
    diff: diffRecords(previous.get(sourceId) ?? [], current.get(sourceId) ?? []),
    findings: {
      unreadable: unreadableBySource.get(sourceId) ?? [],
      outOfJurisdiction: foreignBySource.get(sourceId) ?? [],
    },
  }));
  const { full, prBody } = renderChangeReports(entries, failures);
  await writeFile(fromRoot("build", "change-summary.md"), full);
  await writeFile(fromRoot("build", "change-summary-pr.md"), prBody);
}

export function renderChangeReports(
  entries: ChangeReportEntry[],
  failures: SourceFailure[] = [],
): RenderedChangeReport {
  const fullSections = [];
  const summarySections = [];
  // Failures lead both reports: a source that kept its previous records shows no
  // change at all, so nothing below would reveal that it is not being updated.
  if (failures.length > 0) {
    const section = `${renderFailureSection(failures)}\n`;
    fullSections.push(section);
    summarySections.push(section);
  }
  for (const { sourceId, diff, findings = NO_FINDINGS } of entries) {
    const summary = renderSummarySection(sourceId, diff, findings);
    fullSections.push(`${summary}\n\n${renderDetailsSection(diff, findings)}\n`);
    summarySections.push(`${summary}\n`);
  }
  return {
    full: `${REPORT_HEADING}\n\n${fullSections.join("\n")}`,
    prBody: truncateForPrBody(`${REPORT_HEADING}\n\n${summarySections.join("\n")}`),
  };
}

function renderFailureSection(failures: SourceFailure[]) {
  return `## Failed sources

These sources kept the records they were last published with. Investigate before
treating their data as current.

| Source | Error |
| --- | --- |
${failures.map((failure) => `| ${failure.sourceId} | ${failure.error} |`).join("\n")}`;
}

function renderSummarySection(sourceId: string, diff: RegistryDiff, findings: SourceFindings) {
  return `## ${sourceId}

- Previous records: ${diff.previous}
- Current records: ${diff.current}
- Added: ${diff.added.length}
- Updated: ${diff.updated.length}
- Removed: ${diff.removed.length}
- Unchanged: ${diff.unchanged}
- Unreadable values: ${findings.unreadable.length}
- Out-of-jurisdiction identifiers: ${findings.outOfJurisdiction.length}`;
}

function renderDetailsSection(diff: RegistryDiff, findings: SourceFindings) {
  return `<details>
<summary>Record-level changes</summary>

| Change | Key | Note |
| --- | --- | --- |
${
  [
    ...diff.added.map((record) => `| Added | ${record.key} | n/a |`),
    ...diff.updated.map((record) => `| Updated | ${record.key} | n/a |`),
    ...diff.removed.map((record) => `| Removed | ${record.key} | no longer present in source |`),
    // The values the source published but the run could not use are listed
    // here too: they never became records, so no diff line would mention them.
    ...findings.unreadable.map((row) => `| Unreadable | ${row.sourceValue} | n/a |`),
    ...findings.outOfJurisdiction.map(
      (row) => `| Out of jurisdiction | ${row.sourceValue} | ${row.countryCode} |`,
    ),
  ].join("\n") || "| None | n/a | n/a |"
}

</details>`;
}

function truncateForPrBody(body: string) {
  if (body.length <= PR_BODY_MAX_CHARS) {
    return body;
  }
  const note = "\n\n...truncated, see `build/change-summary.md` for the full report.";
  return `${body.slice(0, PR_BODY_MAX_CHARS - note.length)}${note}`;
}

async function readCurrent(): Promise<NormalizedRegistryRecord[]> {
  try {
    return JSON.parse(
      await readFile(fromRoot("data", "registry.json"), "utf8"),
    ) as NormalizedRegistryRecord[];
  } catch {
    return [];
  }
}

async function readFromGit(): Promise<NormalizedRegistryRecord[]> {
  try {
    const { stdout } = await execFileAsync("git", ["show", "HEAD:data/registry.json"], {
      cwd: fromRoot(),
      // registry.json is several MB. With the default 1 MB maxBuffer the git output
      // overflows, the call rejects, and the previous snapshot reads as empty - making
      // every record look "Added". Allow plenty of room for the committed registry.
      maxBuffer: 512 * 1024 * 1024,
    });
    return JSON.parse(stdout) as NormalizedRegistryRecord[];
  } catch (error) {
    // Only tolerate the legitimate "no committed registry yet" case (first run, or the
    // file not present at HEAD). Anything else (maxBuffer overflow, malformed JSON) must
    // surface rather than silently degrade the diff into an all-"Added" report.
    if (isMissingFromGit(error)) {
      return [];
    }
    throw error;
  }
}

function isMissingFromGit(error: unknown): boolean {
  const stderr = (error as { stderr?: string } | null)?.stderr ?? "";
  return /does not exist|exists on disk, but not in|unknown revision|ambiguous argument/i.test(
    stderr,
  );
}

function groupBySource(records: NormalizedRegistryRecord[]) {
  return Map.groupBy(records, (record) => record.source.registryId);
}

function filter(records: NormalizedRegistryRecord[], sourceId?: string) {
  return sourceId ? records.filter((record) => record.source.registryId === sourceId) : records;
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
