import { API_PREFIX, DISCLAIMER, SCHEMA_VERSION } from "../domain/constants.js";

function successResponse(dataSchema?: string) {
  if (!dataSchema) return { description: "Success" };
  return {
    description: "Success",
    content: {
      "application/json": {
        schema: {
          allOf: [
            { $ref: "#/components/schemas/SuccessResponse" },
            {
              type: "object",
              properties: { data: { $ref: `#/components/schemas/${dataSchema}` } },
            },
          ],
        },
      },
    },
  };
}

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
        [`${API_PREFIX}/parties`, "List parties with filters and cursor pagination"],
        [`${API_PREFIX}/parties/{countryCode}/{partyId}`, "Get a consolidated party"],
        [`${API_PREFIX}/parties/{countryCode}/{partyId}/observations`, "List party observations"],
        [`${API_PREFIX}/parties/{countryCode}/{partyId}/conflicts`, "List party conflicts"],
        [`${API_PREFIX}/sources`, "List sources", "Source"],
        [`${API_PREFIX}/sources/{sourceId}`, "Get a source", "Source"],
        [`${API_PREFIX}/sources/{sourceId}/parties`, "List parties from a source"],
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
            level: {
              type: "string",
              enum: [
                "AUTHORITATIVE",
                "SUPRANATIONAL_DIRECTORY",
                "SECONDARY",
                "SELF_ASSERTED",
                "UNVERIFIED",
              ],
            },
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
            observationType: {
              type: "string",
              enum: [
                "OFFICIAL_ASSIGNMENT",
                "OFFICIAL_DIRECTORY_ENTRY",
                "LEGACY_ASSIGNMENT",
                "NETWORK_REGISTRATION",
                "INFRASTRUCTURE_OBSERVATION",
                "SELF_DECLARATION",
                "COMMUNITY_OBSERVATION",
              ],
            },
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
