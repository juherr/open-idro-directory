import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { ParseOutput } from "../connector.js";
import type { ValidationIssue } from "../../domain/validation-issue.js";
import { mobieRowSchema, type MobieRow } from "./mobie.types.js";

const execFileAsync = promisify(execFile);

export async function parseMobieSnapshot(body: string): Promise<ParseOutput<MobieRow>> {
  const warnings: ValidationIssue[] = [];
  const errors: ValidationIssue[] = [];
  const text = await snapshotText(body);
  const records: MobieRow[] = [];

  for (const row of textRows(text)) {
    const record = mobieRowSchema.safeParse(row);
    if (!record.success) {
      errors.push({
        severity: "error",
        code: "MOBIE_MALFORMED_ROW",
        message: `MOBI.E row is malformed: ${record.error.message}`,
      });
      continue;
    }
    records.push(record.data);
  }

  if (records.length === 0) {
    errors.push({
      severity: "error",
      code: "MOBIE_NO_RECORDS",
      message: "MOBI.E PDF register did not contain parseable records.",
    });
  }

  return { records, warnings, errors };
}

async function snapshotText(body: string) {
  const parsed = JSON.parse(body) as { text?: string; pdfBase64?: string };
  if (typeof parsed.text === "string") return parsed.text;
  if (typeof parsed.pdfBase64 !== "string")
    throw new Error("MOBI.E snapshot is missing pdfBase64.");
  return pdfToText(Buffer.from(parsed.pdfBase64, "base64"));
}

async function pdfToText(pdf: Buffer) {
  const directory = await mkdtemp(join(tmpdir(), "mobie-idro-"));
  const path = join(directory, "register.pdf");
  try {
    await writeFile(path, pdf);
    const { stdout } = await execFileAsync("pdftotext", ["-layout", path, "-"], {
      maxBuffer: 5_000_000,
    });
    return stdout;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      throw new Error("pdftotext is required to parse the MOBI.E PDF snapshot.");
    }
    throw error;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function textRows(text: string) {
  const rows: MobieRow[] = [];
  for (const rawLine of text.replace(/\r/g, "").split("\n")) {
    const line = rawLine.replace(/\s+/g, " ").trim();
    if (!line || line.startsWith("Código ")) continue;
    const match =
      /^(?<code>[A-Z0-9]{4})\s+(?<partyId>[A-Z0-9]{3})\s+(?<name>.+?)\s+(?<emsp>Sim|Não)\s+(?<cpo>Sim|Não)$/u.exec(
        line,
      );
    if (!match?.groups) continue;
    rows.push({
      code: match.groups.code ?? "",
      partyId: match.groups.partyId ?? "",
      organizationName: match.groups.name ?? "",
      isEmsp: match.groups.emsp === "Sim",
      isCpo: match.groups.cpo === "Sim",
    });
  }
  return rows;
}
