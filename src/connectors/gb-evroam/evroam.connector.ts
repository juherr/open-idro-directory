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
import type { ValidationIssue } from "../../domain/validation-issue.js";
import { getText } from "../../infrastructure/http/http-client.js";
import { parseEvroamRegister } from "./evroam.parser.js";
import type { EvroamRegisterItem } from "./evroam.types.js";

const SOURCE_HOSTS = ["evroam.org.uk", "www.evroam.org.uk"];

export class EvroamConnector implements RegistryConnector<EvroamRegisterItem> {
  readonly sourceId = "gb-evroam";

  async fetch(context: FetchContext): Promise<FetchResult> {
    const conditionals = {
      ...(context.previousEtag ? { etag: context.previousEtag } : {}),
      ...(context.previousLastModified ? { lastModified: context.previousLastModified } : {}),
    };
    const response = await getText(
      context.source.registryUrl,
      {
        timeoutMs: 30_000,
        retries: 2,
        maxBytes: 2_000_000,
        allowedHosts: SOURCE_HOSTS,
        userAgent: context.userAgent,
        headers: {
          Accept: "application/json",
          Referer: context.source.homepageUrl,
        },
      },
      conditionals,
    );

    return {
      status: response.status === 304 ? "unchanged" : "changed",
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

  async parse(input: ParseInput): Promise<ParseOutput<EvroamRegisterItem>> {
    return parseEvroamRegister(input.body);
  }

  async normalize(input: NormalizeInput<EvroamRegisterItem>): Promise<NormalizeOutput> {
    const warnings: ValidationIssue[] = [];
    const errors: ValidationIssue[] = [];
    const records: NormalizedRegistryRecord[] = [];
    const seen = new Set<string>();

    for (const sourceRecord of input.records) {
      const identifiers = identifiersFor(sourceRecord);
      for (const identifier of identifiers) {
        const parsed = parseIdentifier(identifier.sourceValue, identifier.countryCode);
        if (!parsed) {
          warnings.push({
            severity: "warning",
            sourceId: input.source.id,
            code: "EVROAM_MALFORMED_IDENTIFIER",
            message: `Unexpected EV Roam ${identifier.field} syntax: ${identifier.sourceValue}`,
          });
          continue;
        }

        const key = makeRegistryKey(
          input.source.id,
          parsed.countryCode,
          parsed.partyId,
          identifier.role,
        );
        if (seen.has(key)) continue;
        seen.add(key);

        records.push({
          key,
          countryCode: parsed.countryCode,
          partyId: parsed.partyId,
          eMobilityId: `${parsed.countryCode}${parsed.partyId}`,
          role: identifier.role,
          status: parsed.countryCode === "GB" ? "ACTIVE" : "UNKNOWN",
          organization: {
            name:
              clean(sourceRecord.title) ??
              `Unspecified EV Roam organization for ${parsed.countryCode}${parsed.partyId}`,
            legalName: clean(sourceRecord.title),
            website: website(sourceRecord.website),
          },
          source: {
            registryId: input.source.id,
            official: input.source.official && parsed.countryCode === "GB",
            sourceRecordId: `${parsed.countryCode}${parsed.partyId}`,
            sourceUrl: input.source.registryUrl,
            sourceValue: identifier.sourceValue,
            firstSeenAt: input.retrievedAt,
            lastSeenAt: input.retrievedAt,
            retrievedAt: input.retrievedAt,
          },
          metadata: {
            evroamField: identifier.field,
            evroamTitle: clean(sourceRecord.title),
            evroamWebsite: clean(sourceRecord.website),
            evroamAuthority:
              parsed.countryCode === "GB" ? "originating-registry" : "cross-register",
          },
        });
      }
    }

    return { records, warnings, errors };
  }
}

interface CandidateIdentifier {
  field: string;
  countryCode: "GB" | "IE";
  role: RegistryRole;
  sourceValue: string;
}

function identifiersFor(record: EvroamRegisterItem): CandidateIdentifier[] {
  const candidates: Array<
    Omit<CandidateIdentifier, "sourceValue"> & { sourceValue: string | null | undefined }
  > = [
    { field: "operatorId", countryCode: "GB", role: "CPO", sourceValue: record.operatorId },
    {
      field: "serviceProviderId",
      countryCode: "GB",
      role: "EMSP",
      sourceValue: record.serviceProviderId,
    },
    { field: "operatorIdIE", countryCode: "IE", role: "CPO", sourceValue: record.operatorIdIE },
    {
      field: "serviceProviderIdIE",
      countryCode: "IE",
      role: "EMSP",
      sourceValue: record.serviceProviderIdIE,
    },
  ];

  return candidates.flatMap((identifier) => {
    const sourceValue = clean(identifier.sourceValue);
    return sourceValue ? [{ ...identifier, sourceValue }] : [];
  });
}

function parseIdentifier(value: string, expectedCountryCode: string) {
  const match = /^([A-Z]{2})[-*]([A-Z0-9]{3})$/i.exec(value.trim());
  if (!match) return null;
  const countryCode = (match[1] ?? "").toUpperCase();
  if (countryCode !== expectedCountryCode) return null;
  return { countryCode, partyId: (match[2] ?? "").toUpperCase() };
}

function website(value: string | null | undefined) {
  const cleaned = clean(value);
  if (!cleaned) return null;
  return URL.canParse(cleaned) ? cleaned : null;
}

function clean(value: string | null | undefined) {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}
