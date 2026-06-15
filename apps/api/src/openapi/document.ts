import { API_PREFIX, DISCLAIMER, SCHEMA_VERSION } from "../domain/constants.js";

export function openApiDocument(origin = "http://localhost:8787") {
  return {
    openapi: "3.1.0",
    info: {
      title: "Open IDRO Directory API",
      version: "1.0.0",
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
        [`${API_PREFIX}/sources`, "List sources"],
        [`${API_PREFIX}/sources/{sourceId}`, "Get a source"],
        [`${API_PREFIX}/sources/{sourceId}/parties`, "List parties from a source"],
        [`${API_PREFIX}/sources/{sourceId}/health`, "Get source health"],
        [`${API_PREFIX}/conflicts`, "List conflicts"],
        [`${API_PREFIX}/stats`, "Dataset statistics"],
        [`${API_PREFIX}/resolve/{emobilityId}`, "Resolve an e-mobility party identifier"],
      ].map(([path, summary]) => [
        path,
        {
          get: {
            summary,
            responses: {
              "200": { description: "Success" },
              "304": { description: "Not modified" },
              "400": { description: "Malformed request" },
              "404": { description: "Unknown resource" },
              "422": { description: "Unsupported filter or identifier" },
              "503": { description: "Database or active dataset unavailable" },
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
      },
    },
    "x-disclaimer": DISCLAIMER,
    "x-pagination": "Cursor pagination only. Default limit is 50 and maximum limit is 200.",
    "x-cache": "ETags are derived from the active dataset checksum and canonical request URL.",
  };
}
