import type {
  FetchContext,
  FetchResult,
  NormalizeInput,
  NormalizeOutput,
  ParseInput,
  ParseOutput,
  RegistryConnector,
} from "../connector.js";
import { makeRegistryKey, type NormalizedRegistryRecord } from "../../domain/registry-record.js";
import { getBinary, sha256 } from "../../infrastructure/http/http-client.js";
import type { ValidationIssue } from "../../domain/validation-issue.js";
import { parseEnergimyndighetenSnapshot } from "./energimyndigheten.parser.js";
import type { EnergimyndighetenRow } from "./energimyndigheten.types.js";

const SOURCE_HOSTS = ["www.energimyndigheten.se"];
const CPO_URL =
  "https://www.energimyndigheten.se/4ac461/globalassets/klimat/laddinfrastruktur/register-av-identifieringsdata.xlsx";
const EMSP_URL =
  "https://www.energimyndigheten.se/49656a/globalassets/klimat/laddinfrastruktur/register-for-emsp.xlsx";
const MAX_WORKBOOK_BYTES = 5_000_000;

export class EnergimyndighetenConnector implements RegistryConnector<EnergimyndighetenRow> {
  readonly sourceId = "se-energimyndigheten";

  async fetch(context: FetchContext): Promise<FetchResult> {
    const [cpo, emsp] = await Promise.all([
      fetchWorkbook(CPO_URL, context),
      fetchWorkbook(EMSP_URL, context),
    ]);
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

  async parse(input: ParseInput): Promise<ParseOutput<EnergimyndighetenRow>> {
    try {
      return parseEnergimyndighetenSnapshot(input.body);
    } catch (error) {
      return {
        records: [],
        warnings: [],
        errors: [
          {
            severity: "error",
            code: "ENERGIMYNDIGHETEN_INVALID_SNAPSHOT",
            message: error instanceof Error ? error.message : String(error),
          },
        ],
      };
    }
  }

  async normalize(input: NormalizeInput<EnergimyndighetenRow>): Promise<NormalizeOutput> {
    const warnings: ValidationIssue[] = [];
    const errors: ValidationIssue[] = [];
    const records: NormalizedRegistryRecord[] = [];
    const seen = new Set<string>();

    for (const sourceRecord of input.records) {
      const parsed = parseEnergimyndighetenIdentifier(sourceRecord.sourceValue);
      if (!parsed) {
        warnings.push({
          severity: "warning",
          sourceId: input.source.id,
          code: "ENERGIMYNDIGHETEN_MALFORMED_IDENTIFIER",
          message: `Unexpected Swedish Energy Agency identifier syntax: ${sourceRecord.sourceValue}`,
        });
        continue;
      }

      const key = makeRegistryKey(
        input.source.id,
        parsed.countryCode,
        parsed.partyId,
        sourceRecord.role,
      );
      if (seen.has(key)) {
        warnings.push({
          severity: "warning",
          sourceId: input.source.id,
          code: "ENERGIMYNDIGHETEN_DUPLICATE_IDENTIFIER",
          message: `Duplicate Swedish Energy Agency identifier ${sourceRecord.sourceValue} for ${sourceRecord.role}.`,
        });
        continue;
      }
      seen.add(key);

      const organizationName =
        sourceRecord.organizationName ?? "Unspecified Swedish Energy Agency organization";
      records.push({
        key,
        countryCode: parsed.countryCode,
        partyId: parsed.partyId,
        eMobilityId: `${parsed.countryCode}${parsed.partyId}`,
        role: sourceRecord.role,
        status: "ACTIVE" as const,
        organization: {
          name: organizationName,
          legalName: organizationName,
          website: null,
        },
        source: {
          registryId: input.source.id,
          official: input.source.official,
          sourceRecordId: `${parsed.countryCode}${parsed.partyId}`,
          sourceUrl: sourceRecord.sourceUrl,
          sourceValue: sourceRecord.sourceValue,
          firstSeenAt: input.retrievedAt,
          lastSeenAt: input.retrievedAt,
          retrievedAt: input.retrievedAt,
        },
        metadata: {
          energimyndighetenCompanyName: organizationName,
          energimyndighetenSeparator: parsed.separator,
        },
      });
    }

    return { records, warnings, errors };
  }
}

async function fetchWorkbook(url: string, context: FetchContext) {
  const response = await getBinary(url, {
    timeoutMs: 30_000,
    retries: 2,
    maxBytes: MAX_WORKBOOK_BYTES,
    allowedHosts: SOURCE_HOSTS,
    userAgent: context.userAgent,
    headers: {
      Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*",
      Referer: context.source.homepageUrl,
    },
  });

  return {
    url: response.finalUrl,
    contentBase64: response.body.toString("base64"),
  };
}

function parseEnergimyndighetenIdentifier(value: string) {
  const match = /^(SE)\s*([*-]?)\s*([A-Za-z0-9]{3,5})$/i.exec(value.trim());
  if (!match) return null;
  return {
    countryCode: "SE",
    separator: match[2] ?? "",
    partyId: (match[3] ?? "").toUpperCase(),
  };
}
