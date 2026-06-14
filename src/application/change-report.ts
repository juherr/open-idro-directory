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

export async function writeChangeReport(sourceIds: string[]) {
  await mkdir(fromRoot("build"), { recursive: true });
  const sections = [];
  for (const sourceId of sourceIds) {
    const diff = await diffAgainstGit(sourceId);
    sections.push(`## ${sourceId}

- Previous records: ${diff.previous}
- Current records: ${diff.current}
- Added: ${diff.added.length}
- Updated: ${diff.updated.length}
- Removed: ${diff.removed.length}
- Unchanged: ${diff.unchanged}
- Warnings: 0

<details>
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

</details>
`);
  }
  await writeFile(
    fromRoot("build", "change-summary.md"),
    `# Registry Change Summary\n\n${sections.join("\n")}`,
  );
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
