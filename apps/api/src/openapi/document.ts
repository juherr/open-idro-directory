import { API_PREFIX, DISCLAIMER, SCHEMA_VERSION } from "../domain/constants.js";

/** `dataSchema` names a component; a `[]` suffix makes it a page of that component. */
function successResponse(dataSchema?: string) {
  if (!dataSchema) return { description: "Success" };
  const item = { $ref: `#/components/schemas/${dataSchema.replace(/\[\]$/, "")}` };
  const data = dataSchema.endsWith("[]")
    ? {
        type: "object",
        required: ["items", "pagination"],
        properties: {
          items: { type: "array", items: item },
          pagination: {
            type: "object",
            required: ["nextCursor"],
            properties: { nextCursor: { type: ["string", "null"] } },
          },
        },
      }
    : item;
  return {
    description: "Success",
    content: {
      "application/json": {
        schema: {
          allOf: [
            { $ref: "#/components/schemas/SuccessResponse" },
            { type: "object", properties: { data } },
          ],
        },
      },
    },
  };
}

const AUTHORITY_LEVELS = [
  "AUTHORITATIVE",
  "SUPRANATIONAL_DIRECTORY",
  "SECONDARY",
  "SELF_ASSERTED",
  "UNVERIFIED",
];

const OBSERVATION_TYPES = [
  "OFFICIAL_ASSIGNMENT",
  "OFFICIAL_DIRECTORY_ENTRY",
  "LEGACY_ASSIGNMENT",
  "NETWORK_REGISTRATION",
  "INFRASTRUCTURE_OBSERVATION",
  "SELF_DECLARATION",
  "COMMUNITY_OBSERVATION",
];

const NULL_UNTIL_0006 = "Null until the first import after migration 0006.";

const nullableString = { type: ["string", "null"] };
const dateTime = { type: "string", format: "date-time" };

function errorResponse(description: string) {
  return {
    description,
    content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
  };
}

/** Error responses documented with their codes, by path. */
const ERROR_RESPONSES: Record<string, Record<string, ReturnType<typeof errorResponse>>> = {
  [`${API_PREFIX}/countries/{countryCode}`]: {
    "404": errorResponse(
      "`COUNTRY_NOT_FOUND`: no source covers the country and no identifier carries it.",
    ),
    "422": errorResponse("`INVALID_COUNTRY_CODE`: the code is not an ISO 3166-1 alpha-2 code."),
  },
};

/** Declares each `{name}` template variable of a path as a required path parameter. */
function pathParameters(path: string) {
  return [...path.matchAll(/\{([^}]+)\}/g)].map(([, name]) => ({
    name,
    in: "path",
    required: true,
    schema: { type: "string" },
  }));
}

export function openApiDocument(origin = "http://localhost:8787") {
  return {
    openapi: "3.1.0",
    info: {
      title: "Open IDRO Directory API",
      version: SCHEMA_VERSION,
      description: DISCLAIMER,
      license: { name: "Apache-2.0" },
    },
    servers: [{ url: origin }],
    paths: Object.fromEntries(
      [
        [API_PREFIX, "API root and dataset links"],
        [`${API_PREFIX}/health`, "Service health"],
        [`${API_PREFIX}/dataset`, "Active dataset metadata"],
        [`${API_PREFIX}/parties`, "List parties with filters and cursor pagination", "Party[]"],
        [`${API_PREFIX}/parties/{countryCode}/{partyId}`, "Get a consolidated party", "Party"],
        [
          `${API_PREFIX}/parties/{countryCode}/{partyId}/observations`,
          "List party observations",
          "Observation[]",
        ],
        [`${API_PREFIX}/parties/{countryCode}/{partyId}/conflicts`, "List party conflicts"],
        [`${API_PREFIX}/sources`, "List sources", "Source"],
        [`${API_PREFIX}/sources/{sourceId}`, "Get a source", "Source"],
        [`${API_PREFIX}/sources/{sourceId}/parties`, "List parties from a source", "Party[]"],
        [`${API_PREFIX}/sources/{sourceId}/health`, "Get source health"],
        [`${API_PREFIX}/conflicts`, "List conflicts"],
        [`${API_PREFIX}/stats`, "Dataset statistics"],
        [`${API_PREFIX}/countries/{countryCode}`, "Get a country summary", "CountrySummary"],
        [`${API_PREFIX}/resolve/{emobilityId}`, "Resolve an e-mobility party identifier"],
      ].map(([path = "", summary, dataSchema]) => [
        path,
        {
          get: {
            summary,
            ...(path.includes("{") && { parameters: pathParameters(path) }),
            responses: {
              "200": successResponse(dataSchema),
              "304": { description: "Not modified" },
              "400": { description: "Malformed request" },
              "404": { description: "Unknown resource" },
              "422": { description: "Unsupported filter or identifier" },
              "503": { description: "Database or active dataset unavailable" },
              ...ERROR_RESPONSES[path],
            },
          },
        },
      ]),
    ),
    components: {
      schemas: {
        SuccessResponse: {
          type: "object",
          required: ["data", "meta"],
          properties: {
            data: {},
            meta: {
              type: "object",
              properties: {
                datasetReleaseId: { type: "string" },
                generatedAt: { type: "string", format: "date-time" },
                schemaVersion: { const: SCHEMA_VERSION },
              },
            },
          },
        },
        ErrorResponse: {
          type: "object",
          required: ["error"],
          properties: {
            error: {
              type: "object",
              required: ["code", "message", "requestId"],
              properties: {
                code: { type: "string" },
                message: { type: "string" },
                details: {},
                requestId: { type: "string" },
              },
            },
          },
        },
        Source: {
          type: "object",
          description:
            "A source descriptor. `authority`, `registry`, and `publication` are the three distinct identities; the sibling flat fields are derived and retained for API schema 1.1.x consumers.",
          required: ["id", "name", "authority", "registry", "publication", "reuse", "health"],
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            authority: { $ref: "#/components/schemas/SourceAuthority" },
            registry: { $ref: "#/components/schemas/SourceRegistry" },
            publication: { $ref: "#/components/schemas/SourcePublication" },
            reuse: { $ref: "#/components/schemas/SourceReuse" },
            official: {
              type: "boolean",
              deprecated: true,
              description:
                'Derived from authority.level === "AUTHORITATIVE". Kept for schema 1.1.x consumers; prefer authority.level.',
            },
            disclaimer: { type: "string" },
          },
        },
        SourceReuse: {
          type: "object",
          required: [
            "status",
            "legalBasis",
            "licence",
            "attributionNotice",
            "redistributionAllowed",
            "notes",
          ],
          properties: {
            status: {
              type: "string",
              enum: ["licensed", "statutory", "permission-granted", "restricted", "unspecified"],
            },
            legalBasis: {
              anyOf: [{ $ref: "#/components/schemas/SourceReference" }, { type: "null" }],
            },
            licence: {
              anyOf: [{ $ref: "#/components/schemas/SourceReference" }, { type: "null" }],
            },
            attributionNotice: { type: ["string", "null"] },
            redistributionAllowed: { type: ["boolean", "null"] },
            notes: { type: ["string", "null"] },
          },
        },
        SourceReference: {
          type: "object",
          required: ["name", "url"],
          properties: {
            name: { type: "string" },
            url: { type: "string", format: "uri" },
          },
        },
        SourceAuthority: {
          type: "object",
          description:
            "The organisation appointed to assign identifiers. Several sources may reference the same authority.",
          required: ["id", "name", "level", "jurisdictions", "homepageUrl"],
          properties: {
            id: { type: ["string", "null"] },
            name: { type: ["string", "null"] },
            level: { type: "string", enum: AUTHORITY_LEVELS },
            jurisdictions: { type: "array", items: { type: "string" } },
            homepageUrl: { type: ["string", "null"], format: "uri" },
            notes: { type: ["string", "null"] },
          },
        },
        SourceRegistry: {
          type: "object",
          description: "The register operated by the authority, and what its entries mean.",
          required: ["url", "observationType", "jurisdictions", "supportedRoles"],
          properties: {
            url: { type: ["string", "null"], format: "uri" },
            observationType: { type: "string", enum: OBSERVATION_TYPES },
            jurisdictions: { type: "array", items: { type: "string" } },
            supportedRoles: {
              type: ["array", "null"],
              items: { type: "string", enum: ["CPO", "EMSP"] },
              description:
                "Roles the register declares it publishes. Null when not yet imported, not when no role is published.",
            },
          },
        },
        CountrySummary: {
          type: "object",
          description:
            "Everything known about one country. Every authority whose remit includes the country is listed and none is designated: where several registers cover a country, `sources[].countryObservations.byAuthorityLevel` shows which one is authoritative for it.",
          required: [
            "countryCode",
            "authorities",
            "sources",
            "coverage",
            "statistics",
            "freshness",
            "datasetTimestamp",
            "links",
          ],
          properties: {
            countryCode: { type: "string", pattern: "^[A-Z]{2}$" },
            authorities: {
              type: "array",
              items: { $ref: "#/components/schemas/CountryAuthority" },
            },
            sources: {
              type: "array",
              description:
                "Sources whose registry declares the country, and any source with identifiers in it.",
              items: { $ref: "#/components/schemas/CountrySource" },
            },
            coverage: {
              type: "object",
              required: ["status", "declaredRoles", "publishedRoles"],
              properties: {
                status: { type: "string", enum: ["PUBLISHED", "NO_PUBLISHED_IDENTIFIERS"] },
                declaredRoles: {
                  type: ["array", "null"],
                  items: { type: "string" },
                  description:
                    "Union of the roles the declaring registers publish. Null when unknown.",
                },
                publishedRoles: {
                  type: "object",
                  additionalProperties: { type: "integer" },
                  description: "Party-role counts for the country, by role.",
                },
              },
            },
            statistics: {
              type: "object",
              required: ["parties", "partyRoles", "observations", "conflicts", "countsByStatus"],
              properties: {
                parties: { type: "integer" },
                partyRoles: { type: "integer" },
                observations: { type: "integer" },
                conflicts: { type: "integer" },
                countsByStatus: { type: "object", additionalProperties: { type: "integer" } },
              },
            },
            freshness: {
              type: "object",
              required: ["latestSuccessfulRetrievalAt", "staleSourceIds"],
              properties: {
                latestSuccessfulRetrievalAt: { type: ["string", "null"], format: "date-time" },
                staleSourceIds: { type: "array", items: { type: "string" } },
              },
            },
            datasetTimestamp: { type: "string", format: "date-time" },
            links: {
              type: "object",
              required: ["self", "parties", "conflicts"],
              properties: {
                self: { type: "string" },
                parties: { type: "string" },
                conflicts: { type: "string" },
              },
            },
          },
        },
        CountryAuthority: {
          allOf: [
            { $ref: "#/components/schemas/SourceAuthority" },
            {
              type: "object",
              required: ["sourceIds"],
              properties: {
                sourceIds: {
                  type: "array",
                  items: { type: "string" },
                  description:
                    "This authority's sources relevant to the country. Empty when it publishes nothing for it.",
                },
              },
            },
          ],
        },
        CountrySource: {
          allOf: [
            { $ref: "#/components/schemas/Source" },
            {
              type: "object",
              required: ["countryObservations"],
              properties: {
                countryObservations: {
                  type: "object",
                  required: ["total", "byAuthorityLevel"],
                  properties: {
                    total: { type: "integer" },
                    byAuthorityLevel: {
                      type: "object",
                      additionalProperties: { type: "integer" },
                    },
                  },
                },
              },
            },
          ],
        },
        Party: {
          type: "object",
          description:
            "A consolidated party. The issuing country, the observations (`/observations`) and each role's `issuing` confirmation are distinct facts. `status`, `highestAuthorityLevel` and `hasConflict` are derived from the observations for convenience and never replace them. The party detail adds `alternativeNames`, `sourceSummary`, `conflictSummary`, `freshnessSummary` and `links`; party lists return `roles` empty.",
          required: [
            "key",
            "countryCode",
            "issuingCountry",
            "partyId",
            "eMobilityId",
            "preferredName",
            "legalName",
            "website",
            "status",
            "highestAuthorityLevel",
            "roleCount",
            "observationCount",
            "hasConflict",
            "firstSeenAt",
            "lastSeenAt",
            "roles",
          ],
          properties: {
            key: { type: "string" },
            countryCode: { type: "string", pattern: "^[A-Z]{2}$" },
            issuingCountry: {
              type: "string",
              pattern: "^[A-Z]{2}$",
              description:
                "The identifier's prefix country, which issues it. A listing by another country's register never changes it.",
            },
            partyId: { type: "string" },
            eMobilityId: { type: "string" },
            preferredName: {
              ...nullableString,
              description:
                "Name from the preferred observation: an assignment by the issuing register comes before any cross-register listing.",
            },
            legalName: nullableString,
            website: nullableString,
            status: {
              type: "string",
              description: "Derived from the statuses of the observations.",
            },
            highestAuthorityLevel: {
              type: "string",
              enum: AUTHORITY_LEVELS,
              description:
                "Derived: the strongest authority level among the observations. A party only listed outside its country is SECONDARY.",
            },
            roleCount: { type: "integer" },
            observationCount: { type: "integer" },
            hasConflict: {
              type: "boolean",
              description: "Derived from the conflict diagnostics.",
            },
            firstSeenAt: dateTime,
            lastSeenAt: dateTime,
            roles: { type: "array", items: { $ref: "#/components/schemas/PartyRole" } },
          },
        },
        PartyRole: {
          type: "object",
          required: [
            "role",
            "status",
            "highestAuthorityLevel",
            "observationCount",
            "hasConflict",
            "issuing",
          ],
          properties: {
            role: { type: "string", enum: ["CPO", "EMSP"] },
            status: { type: "string", description: "Derived from the role's observations." },
            highestAuthorityLevel: {
              type: "string",
              enum: AUTHORITY_LEVELS,
              description: "Derived: the strongest authority level among the role's observations.",
            },
            observationCount: { type: "integer" },
            hasConflict: { type: "boolean", description: "Derived from the conflict diagnostics." },
            issuing: { $ref: "#/components/schemas/IssuingConfirmation" },
          },
        },
        IssuingConfirmation: {
          type: "object",
          description:
            "What the issuing country's register says about this identifier and role, evaluated independently of any listing by another register. It states whether the identifier was found in the issuing register, not whether it is legally valid.",
          required: ["confirmation", "confirmedBy"],
          properties: {
            confirmation: {
              type: ["string", "null"],
              enum: [
                "CONFIRMED",
                "NOT_FOUND",
                "SOURCE_STALE",
                "SOURCE_UNAVAILABLE",
                "UNSUPPORTED_ROLE",
                "NO_ISSUING_SOURCE",
                null,
              ],
              description: `CONFIRMED: an issuing register lists it. NOT_FOUND: not found in the issuing register, every issuing register being current. SOURCE_STALE / SOURCE_UNAVAILABLE: an issuing register is stale, or failed or disabled, so its silence proves nothing. UNSUPPORTED_ROLE: the country's registers do not publish this role. NO_ISSUING_SOURCE: no authoritative register covers the country. ${NULL_UNTIL_0006}`,
            },
            confirmedBy: {
              type: ["array", "null"],
              items: { type: "string" },
              description: `Ids of the issuing registers that list it; empty unless CONFIRMED. ${NULL_UNTIL_0006}`,
            },
          },
        },
        Observation: {
          type: "object",
          description:
            "One source's claim about an identifier and role, with its provenance. Several registers may observe the same identifier; a listing by another country's register does not make that country the issuer.",
          required: [
            "key",
            "partyKey",
            "sourceId",
            "scheme",
            "countryCode",
            "partyId",
            "eMobilityId",
            "role",
            "status",
            "organizationName",
            "legalName",
            "website",
            "sourceRecordId",
            "sourceValue",
            "sourceUrl",
            "authorityLevel",
            "observationType",
            "observationKind",
            "observingJurisdiction",
            "firstSeenAt",
            "lastSeenAt",
            "retrievedAt",
            "metadata",
            "rawRecordChecksum",
          ],
          properties: {
            key: { type: "string" },
            partyKey: { type: "string" },
            sourceId: { type: "string" },
            scheme: { type: "string" },
            countryCode: { type: "string", pattern: "^[A-Z]{2}$" },
            partyId: { type: "string" },
            eMobilityId: { type: "string" },
            role: { type: "string", enum: ["CPO", "EMSP"] },
            status: { type: "string" },
            organizationName: nullableString,
            legalName: nullableString,
            website: nullableString,
            sourceRecordId: nullableString,
            sourceValue: { type: "string" },
            sourceUrl: { type: "string" },
            authorityLevel: {
              type: "string",
              enum: AUTHORITY_LEVELS,
              description:
                "The source's level for an assignment; SECONDARY for a cross-register listing.",
            },
            observationType: { type: "string", enum: OBSERVATION_TYPES },
            observationKind: {
              type: ["string", "null"],
              enum: ["ASSIGNMENT", "CROSS_REGISTER_LISTING", null],
              description: `ASSIGNMENT: the register covers the identifier's country. CROSS_REGISTER_LISTING: the register lists another country's identifier, which neither makes it the issuer nor says anything about the identifier's standing with its issuer. ${NULL_UNTIL_0006}`,
            },
            observingJurisdiction: {
              ...nullableString,
              description: `Country of the register that published the observation. Also null for a listing by a register covering several countries. ${NULL_UNTIL_0006}`,
            },
            firstSeenAt: dateTime,
            lastSeenAt: dateTime,
            retrievedAt: dateTime,
            metadata: { type: "object" },
            rawRecordChecksum: nullableString,
          },
        },
        SourcePublication: {
          type: "object",
          description:
            "The technical resource this project consumes. A null machineReadableUrl means no stable machine-readable publication was found, not that the registry is absent.",
          required: ["machineReadableUrl", "verifiedAt"],
          properties: {
            machineReadableUrl: { type: ["string", "null"], format: "uri" },
            verifiedAt: { type: ["string", "null"], format: "date" },
          },
        },
      },
    },
    "x-disclaimer": DISCLAIMER,
    "x-pagination": "Cursor pagination only. Default limit is 50 and maximum limit is 200.",
    "x-cache":
      "ETags are derived from the active dataset release, its checksum and the canonical request URL.",
  };
}
