import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FetchResult } from "../../connectors/connector.js";
import { fromRoot } from "./paths.js";

export interface RawSnapshotMetadata {
  sourceId: string;
  contentType: string | null;
  finalUrl: string;
  httpStatus: number;
  retrievedAt: string;
  etag: string | null;
  lastModified: string | null;
  checksum: string;
}

export async function preserveRawSnapshot(result: FetchResult) {
  const sourceDir = fromRoot("data", "raw", result.sourceId);
  const current = path.join(sourceDir, "current");
  const previous = path.join(sourceDir, "previous");
  await mkdir(sourceDir, { recursive: true });
  await rm(previous, { recursive: true, force: true });
  await rename(current, previous).catch(() => undefined);
  await mkdir(current, { recursive: true });
  await writeFile(
    path.join(current, "body.json"),
    formatSnapshotBody(result.body, result.contentType),
  );
  await writeFile(
    path.join(current, "metadata.json"),
    `${JSON.stringify(
      {
        sourceId: result.sourceId,
        contentType: result.contentType,
        finalUrl: result.finalUrl,
        httpStatus: result.httpStatus,
        retrievedAt: result.retrievedAt,
        etag: result.etag,
        lastModified: result.lastModified,
        checksum: result.checksum,
      } satisfies RawSnapshotMetadata,
      null,
      2,
    )}\n`,
  );
}

/**
 * Pretty-prints JSON response bodies so the committed snapshot produces readable git diffs
 * (the upstream APIs return minified single-line JSON). Non-JSON bodies — and JSON that fails
 * to parse — are preserved byte-for-byte. The snapshot is only ever re-parsed (whitespace
 * insensitive) and scanned for fallback markers, and change detection uses the metadata
 * checksum of the raw response, so reformatting here is safe.
 */
export function formatSnapshotBody(body: string, contentType: string | null): string {
  if (!isJsonBody(body, contentType)) {
    return body;
  }
  try {
    return `${JSON.stringify(JSON.parse(body), null, 2)}\n`;
  } catch {
    return body;
  }
}

function isJsonBody(body: string, contentType: string | null): boolean {
  if (contentType) {
    return /\bjson\b/i.test(contentType);
  }
  const start = body.trimStart()[0];
  return start === "{" || start === "[";
}

export async function readCurrentSnapshot(sourceId: string) {
  const dir = fromRoot("data", "raw", sourceId, "current");
  const body = await readFile(path.join(dir, "body.json"), "utf8");
  const metadata = JSON.parse(
    await readFile(path.join(dir, "metadata.json"), "utf8"),
  ) as RawSnapshotMetadata;
  return { body, metadata };
}

export async function readPreviousSnapshot(sourceId: string) {
  const dir = fromRoot("data", "raw", sourceId, "previous");
  const body = await readFile(path.join(dir, "body.json"), "utf8");
  const metadata = JSON.parse(
    await readFile(path.join(dir, "metadata.json"), "utf8"),
  ) as RawSnapshotMetadata;
  return { body, metadata };
}
