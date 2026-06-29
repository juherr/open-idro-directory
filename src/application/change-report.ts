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

export interface ChangeReportEntry {
  sourceId: string;
  diff: RegistryDiff;
}

export interface RenderedChangeReport {
  /** Full report: per-source counts plus the record-level tables. */
  full: string;
  /** PR-body report: counts only, no record-level tables, capped to GitHub's body limit. */
  prBody: string;
}

export async function writeChangeReport(sourceIds: string[]) {
  await mkdir(fromRoot("build"), { recursive: true });
  const entries: ChangeReportEntry[] = [];
  for (const sourceId of sourceIds) {
    entries.push({ sourceId, diff: await diffAgainstGit(sourceId) });
  }
  const { full, prBody } = renderChangeReports(entries);
  await writeFile(fromRoot("build", "change-summary.md"), full);
  await writeFile(fromRoot("build", "change-summary-pr.md"), prBody);
}

export function renderChangeReports(entries: ChangeReportEntry[]): RenderedChangeReport {
  const fullSections = [];
  const summarySections = [];
  for (const { sourceId, diff } of entries) {
    const summary = renderSummarySection(sourceId, diff);
    fullSections.push(`${summary}\n\n${renderDetailsSection(diff)}\n`);
    summarySections.push(`${summary}\n`);
  }
  return {
    full: `${REPORT_HEADING}\n\n${fullSections.join("\n")}`,
    prBody: truncateForPrBody(`${REPORT_HEADING}\n\n${summarySections.join("\n")}`),
  };
}

function renderSummarySection(sourceId: string, diff: RegistryDiff) {
  return `## ${sourceId}

- Previous records: ${diff.previous}
- Current records: ${diff.current}
- Added: ${diff.added.length}
- Updated: ${diff.updated.length}
- Removed: ${diff.removed.length}
- Unchanged: ${diff.unchanged}
- Warnings: 0`;
}

function renderDetailsSection(diff: RegistryDiff) {
  return `<details>
<summary>Record-level changes</summary>

| Change | Key | Removal interpretation |
| --- | --- | --- |
${
  [
    ...diff.added.map((record) => `| Added | ${record.key} | n/a |`),
    ...diff.updated.map((record) => `| Updated | ${record.key} | n/a |`),
    ...diff.removed.map((record) => `| Removed | ${record.key} | no longer present in source |`),
  ].join("\n") || "| None | n/a | n/a |"
}

</details>`;
}

function truncateForPrBody(body: string) {
  if (body.length <= PR_BODY_MAX_CHARS) {
    return body;
  }
  const note = "\n\n…truncated, see `build/change-summary.md` for the full report.";
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
    });
    return JSON.parse(stdout) as NormalizedRegistryRecord[];
  } catch {
    return [];
  }
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
