import type {
  FetchContext,
  FetchResult,
  NormalizeInput,
  NormalizeOutput,
  ParseInput,
  ParseOutput,
  RegistryConnector,
} from "../connector.js";
import {
  makeRegistryKey,
  type NormalizedRegistryRecord,
  type RegistryRole,
} from "../../domain/registry-record.js";
import { getText, sha256 } from "../../infrastructure/http/http-client.js";
import type { ValidationIssue } from "../../domain/validation-issue.js";
import { parseBdewJson } from "./bdew.parser.js";
import { bdewApiResponseSchema, type BdewApiCode, type BdewSnapshot } from "./bdew.types.js";

const SOURCE_HOSTS = ["bdew-codes.de"];
const PAGE_SIZE = 500;

export class BdewConnector implements RegistryConnector<BdewSnapshot> {
  readonly sourceId = "de-bdew";

  async fetch(context: FetchContext): Promise<FetchResult> {
    const [emsp, cpo] = await Promise.all([fetchCodes(context, true), fetchCodes(context, false)]);
    const body = JSON.stringify({ cpo, emsp });

    return {
      status: "changed",
      sourceId: this.sourceId,
      body,
      contentType: "application/json",
      finalUrl: context.source.registryUrl,
      httpStatus: 200,
      retrievedAt: context.retrievedAt,
      checksum: sha256(body),
      etag: null,
      lastModified: null,
    };
  }

  async parse(input: ParseInput): Promise<ParseOutput<BdewSnapshot>> {
    try {
      return parseBdewJson(input.body);
    } catch (error) {
      return {
        records: [],
        warnings: [],
        errors: [
          {
            severity: "error",
            code: "BDEW_INVALID_JSON",
            message: error instanceof Error ? error.message : String(error),
          },
        ],
      };
    }
  }

  async normalize(input: NormalizeInput<BdewSnapshot>): Promise<NormalizeOutput> {
    const warnings: ValidationIssue[] = [];
    const errors: ValidationIssue[] = [];
    const records: NormalizedRegistryRecord[] = [];
    const seen = new Set<string>();
    const snapshot = input.records[0];
    if (!snapshot) return { records, warnings, errors };

    for (const sourceRecord of snapshot.cpo) {
      normalizeCode(input, sourceRecord, "CPO", records, warnings, seen);
    }
    for (const sourceRecord of snapshot.emsp) {
      normalizeCode(input, sourceRecord, "EMSP", records, warnings, seen);
    }

    return { records, warnings, errors };
  }
}

async function fetchCodes(context: FetchContext, showProviderId: boolean) {
  const records: BdewApiCode[] = [];
  let total = Number.POSITIVE_INFINITY;

  for (let startIndex = 0; startIndex < total; startIndex += PAGE_SIZE) {
    const url = new URL("Codenumbers/EMobilityId/GetActiveCodes", context.source.registryUrl);
    url.searchParams.set("showProviderId", String(showProviderId));
    url.searchParams.set("jtStartIndex", String(startIndex));
    url.searchParams.set("jtPageSize", String(PAGE_SIZE));

    const response = await getText(url.toString(), {
      timeoutMs: 30_000,
      retries: 2,
      maxBytes: 2_000_000,
      allowedHosts: SOURCE_HOSTS,
      userAgent: context.userAgent,
      headers: {
        Accept: "application/json,*/*",
      },
    });
    const parsed = bdewApiResponseSchema.safeParse(JSON.parse(response.body));
    if (!parsed.success) {
      throw new Error(`Unexpected BDEW API response shape: ${parsed.error.message}`);
    }
    if (parsed.data.Result !== "OK") {
      throw new Error(`BDEW API returned Result=${parsed.data.Result}`);
    }

    total = parsed.data.TotalRecordCount;
    records.push(...parsed.data.Records);
    if (parsed.data.Records.length === 0) break;
  }

  return records;
}

function normalizeCode(
  input: NormalizeInput<BdewSnapshot>,
  sourceRecord: BdewApiCode,
  role: RegistryRole,
  records: NormalizedRegistryRecord[],
  warnings: ValidationIssue[],
  seen: Set<string>,
) {
  const parsed = parseBdewIdentifier(sourceRecord.Code);
  if (!parsed) {
    warnings.push({
      severity: "warning",
      sourceId: input.source.id,
      code: "BDEW_MALFORMED_IDENTIFIER",
      message: `Unexpected BDEW identifier syntax: ${sourceRecord.Code}`,
    });
    return;
  }

  const key = makeRegistryKey(input.source.id, parsed.countryCode, parsed.partyId, role);
  if (seen.has(key)) {
    warnings.push({
      severity: "warning",
      sourceId: input.source.id,
      code: "BDEW_DUPLICATE_IDENTIFIER",
      message: `Duplicate BDEW identifier ${sourceRecord.Code} for ${role}.`,
    });
    return;
  }
  seen.add(key);

  const organizationName = cleanCompany(sourceRecord.Company) ?? "Unspecified BDEW organization";
  records.push({
    key,
    countryCode: parsed.countryCode,
    partyId: parsed.partyId,
    eMobilityId: `${parsed.countryCode}${parsed.partyId}`,
    role,
    status: "ACTIVE",
    organization: {
      name: organizationName,
      legalName: organizationName,
      website: null,
    },
    source: {
      registryId: input.source.id,
      official: input.source.official,
      sourceRecordId: String(sourceRecord.Id),
      sourceUrl: bdewSourceUrl(input.source.registryUrl, role),
      sourceValue: sourceRecord.Code,
      firstSeenAt: input.retrievedAt,
      lastSeenAt: input.retrievedAt,
      retrievedAt: input.retrievedAt,
    },
    metadata: {
      bdewId: sourceRecord.Id,
      bdewCompanyName: organizationName,
      bdewSeparator: parsed.separator,
    },
  });
}

function bdewSourceUrl(registryUrl: string, role: RegistryRole) {
  const url = new URL("Codenumbers/EMobilityId/GetActiveCodes", registryUrl);
  url.searchParams.set("showProviderId", String(role === "EMSP"));
  return url.toString();
}

function parseBdewIdentifier(value: string) {
  const match = /^(DE)\s*([*-]?)\s*([A-Za-z0-9]{3})$/i.exec(value.trim());
  if (!match) return null;
  return {
    countryCode: "DE",
    separator: match[2] ?? "",
    partyId: (match[3] ?? "").toUpperCase(),
  };
}

function cleanCompany(value: string | null | undefined) {
  const trimmed = (value ?? "").trim().replace(/\s+/g, " ");
  if (trimmed.length === 0) return null;
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) return trimmed.slice(1, -1);
  return trimmed;
}
