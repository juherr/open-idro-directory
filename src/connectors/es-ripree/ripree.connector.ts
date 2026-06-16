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
import { postText } from "../../infrastructure/http/http-client.js";
import type { ValidationIssue } from "../../domain/validation-issue.js";
import { parseRipreeXml } from "./ripree.parser.js";
import type { RipreeXmlRow } from "./ripree.types.js";

const SOURCE_HOSTS = ["energia.serviciosmin.gob.es"];

export class RipreeConnector implements RegistryConnector<RipreeXmlRow> {
  readonly sourceId = "es-ripree";

  async fetch(context: FetchContext): Promise<FetchResult> {
    const response = await postText(xmlExportUrl(context.source.registryUrl), "{}", {
      timeoutMs: 30_000,
      retries: 2,
      maxBytes: 2_000_000,
      allowedHosts: SOURCE_HOSTS,
      userAgent: context.userAgent,
      headers: {
        Accept: "text/xml,application/xml,*/*",
        "Content-Type": "application/json",
        Referer: context.source.registryUrl,
      },
    });
    return {
      status: "changed",
      sourceId: this.sourceId,
      body: response.body,
      contentType: response.contentType,
      finalUrl: response.finalUrl,
      httpStatus: response.status,
      retrievedAt: context.retrievedAt,
      checksum: response.checksum,
      etag: response.etag,
      lastModified: response.lastModified,
    };
  }

  async parse(input: ParseInput): Promise<ParseOutput<RipreeXmlRow>> {
    try {
      return parseRipreeXml(input.body);
    } catch (error) {
      return {
        records: [],
        warnings: [],
        errors: [
          {
            severity: "error",
            code: "RIPREE_INVALID_XML",
            message: error instanceof Error ? error.message : String(error),
          },
        ],
      };
    }
  }

  async normalize(input: NormalizeInput<RipreeXmlRow>): Promise<NormalizeOutput> {
    const warnings: ValidationIssue[] = [];
    const errors: ValidationIssue[] = [];
    const records: NormalizedRegistryRecord[] = [];
    const seen = new Set<string>();

    for (const sourceRecord of input.records) {
      const parsed = parseRipreeIdentifier(sourceRecord.sourceValue);
      if (!parsed) {
        warnings.push({
          severity: "warning",
          sourceId: input.source.id,
          code: "RIPREE_MALFORMED_IDENTIFIER",
          message: `Unexpected Spanish RIPREE identifier syntax: ${sourceRecord.sourceValue}`,
        });
        continue;
      }

      const role = parseRole(sourceRecord.companyType);
      if (!role) {
        warnings.push({
          severity: "warning",
          sourceId: input.source.id,
          code: "RIPREE_UNKNOWN_ROLE",
          message: `Unknown Spanish RIPREE company type ${sourceRecord.companyType} for ${sourceRecord.sourceValue}.`,
        });
        continue;
      }

      const key = makeRegistryKey(input.source.id, parsed.countryCode, parsed.partyId, role);
      if (seen.has(key)) {
        warnings.push({
          severity: "warning",
          sourceId: input.source.id,
          code: "RIPREE_DUPLICATE_IDENTIFIER",
          message: `Duplicate Spanish RIPREE identifier ${sourceRecord.sourceValue} for ${role}.`,
        });
        continue;
      }
      seen.add(key);

      const organizationName =
        clean(sourceRecord.organizationName) ?? `Unspecified Spanish RIPREE organization`;
      records.push({
        key,
        countryCode: parsed.countryCode,
        partyId: parsed.partyId,
        eMobilityId: `${parsed.countryCode}${parsed.partyId}`,
        role,
        status: "ACTIVE" as const,
        organization: {
          name: organizationName,
          legalName: organizationName,
          website: normalizeWebsite(sourceRecord.website),
        },
        source: {
          registryId: input.source.id,
          official: input.source.official,
          sourceRecordId: `${parsed.countryCode}${parsed.partyId}`,
          sourceUrl: input.source.registryUrl,
          sourceValue: sourceRecord.sourceValue,
          firstSeenAt: input.retrievedAt,
          lastSeenAt: input.retrievedAt,
          retrievedAt: input.retrievedAt,
        },
        metadata: {
          ripreeDocument: sourceRecord.document,
          ripreeCompanyType: sourceRecord.companyType,
          ripreeAddress: sourceRecord.address,
          ripreeCountry: sourceRecord.country,
          ripreeAutonomousCommunity: sourceRecord.autonomousCommunity,
          ripreeProvince: sourceRecord.province,
          ripreeMunicipality: sourceRecord.municipality,
          ripreePostalCode: sourceRecord.postalCode,
          ripreeWebsite: sourceRecord.website,
          ripreeSeparator: parsed.separator,
        },
      });
    }

    return { records, warnings, errors };
  }
}

function xmlExportUrl(registryUrl: string) {
  const url = new URL(registryUrl);
  if (/\/ExportarEmpresas\/Export\/?$/i.test(url.pathname)) {
    url.pathname = url.pathname.replace(
      /\/ExportarEmpresas\/Export\/?$/i,
      "/ExportarEmpresas/GenerarXml",
    );
  }
  return url.toString();
}

function parseRipreeIdentifier(value: string) {
  const match = /^(ES)\s*([*-])\s*([A-Za-z0-9]{3})$/i.exec(value.trim());
  if (!match) return null;
  return {
    countryCode: "ES",
    separator: match[2] ?? "",
    partyId: (match[3] ?? "").toUpperCase(),
  };
}

function parseRole(value: string): RegistryRole | null {
  const normalized = value.trim().toUpperCase();
  if (normalized === "CPO") return "CPO";
  if (normalized === "EMSP" || normalized === "MSP") return "EMSP";
  return null;
}

function normalizeWebsite(value: string | null) {
  const cleaned = clean(value);
  if (!cleaned) return null;
  const emailDomain = /^[^\s@]+@(?<domain>[A-Za-z0-9.-]+\.[A-Za-z]{2,})$/.exec(cleaned)?.groups
    ?.domain;
  const websiteValue = emailDomain ?? cleaned;
  const withProtocol = /^https?:\/\//i.test(websiteValue)
    ? websiteValue
    : `https://${websiteValue}`;
  try {
    const url = new URL(withProtocol);
    if (url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function clean(value: string | null | undefined) {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}
