import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ParseOutput } from "../connector.js";
import type { ValidationIssue } from "../../domain/validation-issue.js";
import { tiiRowSchema, type TiiRow } from "./tii.types.js";

const execFileAsync = promisify(execFile);

export async function parseTiiSnapshot(body: string): Promise<ParseOutput<TiiRow>> {
  const warnings: ValidationIssue[] = [];
  const errors: ValidationIssue[] = [];
  const text = await snapshotText(body);
  const records: TiiRow[] = [];

  for (const row of registryRows(text)) {
    const record = tiiRowSchema.safeParse({
      legalEntityName: row.legalEntityName,
      tradingName: row.tradingName,
      idroIssuedPartyId: normalizeIdentifier(row.idroIssuedPartyId),
      ocpiPartyIds: parseOcpiPartyIds(row.ocpiPartyIds),
      isCpo: /^yes$/i.test(row.cpo),
      isEmsp: /^yes$/i.test(row.emsp),
    });
    if (!record.success) {
      errors.push({
        severity: "error",
        code: "TII_MALFORMED_ROW",
        message: `Irish IDRO row is malformed: ${record.error.message}`,
      });
      continue;
    }
    records.push(record.data);
  }

  if (records.length === 0) {
    errors.push({
      severity: "error",
      code: "TII_NO_RECORDS",
      message: "Irish IDRO public register did not contain parseable records.",
    });
  }

  return { records, warnings, errors };
}

async function snapshotText(body: string) {
  const parsed = JSON.parse(body) as { text?: string; pdfBase64?: string };
  if (typeof parsed.text === "string") return parsed.text;
  if (typeof parsed.pdfBase64 !== "string") throw new Error("TII snapshot is missing pdfBase64.");
  return pdfToText(Buffer.from(parsed.pdfBase64, "base64"));
}

async function pdfToText(pdf: Buffer) {
  const directory = await mkdtemp(join(tmpdir(), "tii-idro-"));
  const path = join(directory, "register.pdf");
  try {
    await writeFile(path, pdf);
    const { stdout } = await execFileAsync("pdftotext", ["-layout", path, "-"], {
      maxBuffer: 5_000_000,
    });
    return stdout;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      throw new Error("pdftotext is required to parse the Irish IDRO PDF snapshot.");
    }
    throw error;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

interface LayoutColumns {
  legalStart: number;
  tradingStart: number;
  idStart: number;
  cpoStart: number;
}

interface LayoutRow {
  legalEntityName: string;
  tradingName: string | null;
  idroIssuedPartyId: string;
  ocpiPartyIds: string;
  cpo: string;
  emsp: string;
}

function registryRows(text: string) {
  const rows: LayoutRow[] = [];
  let columns: LayoutColumns | null = null;
  let pendingLegal: string[] = [];
  let pendingTrading: string[] = [];
  const rawLines = text.replace(/\r/g, "").split("\n");

  for (let index = 0; index < rawLines.length; index++) {
    const rawLine = rawLines[index] ?? "";
    const line = rawLine.replace(/[ \f\v]+/g, " ").trim();
    if (!line || line.startsWith("-- ") || line.startsWith("Last Updated")) continue;
    if (line.includes("Legal Entity Name") && line.includes("Trading Name")) {
      columns = extractColumns(rawLine);
      continue;
    }
    if (!columns || isIrishHeaderContinuation(line)) continue;

    const idMatch = /\bIE\s*-\s*[A-Za-z0-9]{3}\b/.exec(rawLine);
    if (!idMatch) {
      appendContinuation(rawLine, columns, pendingLegal, pendingTrading);
      continue;
    }

    const suffix = rawLine.slice(idMatch.index).trim();
    const suffixMatch =
      /^(?<id>IE\s*-\s*[A-Za-z0-9]{3})\s+(?<ocpi>.+?)\s+(?<cpo>Yes|No)\s+(?<emsp>Yes|No)\s*$/i.exec(
        suffix,
      );
    if (!suffixMatch?.groups) continue;

    const legalParts = [
      ...pendingLegal,
      rawLine.slice(columns.legalStart, columns.tradingStart).trim(),
    ].filter(Boolean);
    const tradingParts = [
      ...pendingTrading,
      rawLine.slice(columns.tradingStart, idMatch.index).trim(),
    ].filter(Boolean);

    while (index + 1 < rawLines.length) {
      const nextRaw = rawLines[index + 1] ?? "";
      const next = nextRaw.replace(/[ \f\v]+/g, " ").trim();
      if (
        !next ||
        next.startsWith("-- ") ||
        next.startsWith("Last Updated") ||
        /\bIE\s*-\s*[A-Za-z0-9]{3}\b/.test(nextRaw)
      ) {
        break;
      }
      appendContinuation(nextRaw, columns, legalParts, tradingParts);
      index++;
    }

    rows.push({
      legalEntityName: legalParts.join(" "),
      tradingName: tradingParts.length > 0 ? tradingParts.join(" ") : null,
      idroIssuedPartyId: suffixMatch.groups.id ?? "",
      ocpiPartyIds: suffixMatch.groups.ocpi ?? "",
      cpo: suffixMatch.groups.cpo ?? "",
      emsp: suffixMatch.groups.emsp ?? "",
    });
    pendingLegal = [];
    pendingTrading = [];
  }
  return rows;
}

function extractColumns(header: string): LayoutColumns {
  return {
    legalStart: Math.max(0, header.indexOf("Legal Entity Name")),
    tradingStart: header.indexOf("Trading Name"),
    idStart: header.indexOf("IDRO"),
    cpoStart: header.indexOf("CPO"),
  };
}

function appendContinuation(
  rawLine: string,
  columns: LayoutColumns,
  legalParts: string[],
  tradingParts: string[],
) {
  const firstTextIndex = rawLine.search(/\S/);
  if (firstTextIndex < 0) return;
  if (firstTextIndex >= columns.tradingStart && firstTextIndex < columns.idStart) {
    tradingParts.push(rawLine.slice(columns.tradingStart, columns.idStart).trim());
  } else if (firstTextIndex < columns.tradingStart || firstTextIndex >= columns.cpoStart) {
    legalParts.push(rawLine.slice(columns.legalStart, columns.tradingStart).trim());
  }
}

function isIrishHeaderContinuation(line: string) {
  return (
    line === "Issued accessible recharging infrastructure in" ||
    line === "Party ID Ireland through TII’s DXP (where" ||
    line === "different from IDRO Issued Party ID)"
  );
}

function parseOcpiPartyIds(value: string) {
  const cleaned = value.trim();
  if (/^n\/a$/i.test(cleaned)) return [];
  return cleaned
    .split(/[;,|]\s*/)
    .map(normalizeIdentifier)
    .filter((item) => /^[A-Z]{2}[A-Z0-9]{3}$/.test(item));
}

function normalizeIdentifier(value: string) {
  return value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}
