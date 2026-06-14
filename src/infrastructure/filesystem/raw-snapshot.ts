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
  await writeFile(path.join(current, "body.json"), result.body);
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
