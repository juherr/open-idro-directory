import { readFile, writeFile, mkdir } from "node:fs/promises";
import {
  EMI3_COUNTRY_CODE_PATTERN,
  EMI3_IDENTIFIER_PATTERN,
  EMI3_PARTY_ID_PATTERN,
} from "../domain/emi3-identifier.js";
import type { NormalizedRegistryRecord } from "../domain/registry-record.js";
import type { SourceDefinition } from "../domain/source-definition.js";
import { fromRoot } from "../infrastructure/filesystem/paths.js";
import { validateRegistry } from "../validation/registry-validator.js";

export async function validateGeneratedRegistry(sources: SourceDefinition[]) {
  await writeSchemas();
  const records = JSON.parse(
    await readFile(fromRoot("data", "registry.json"), "utf8"),
  ) as NormalizedRegistryRecord[];
  const issues = validateRegistry(records, sources);
  const errors = issues.filter((issue) => issue.severity === "error");
  if (errors.length > 0) throw new Error(errors.map((issue) => issue.message).join("; "));
  return issues;
}

export async function writeSchemas() {
  await mkdir(fromRoot("schemas"), { recursive: true });
  await writeFile(
    fromRoot("schemas", "registry.schema.json"),
    `${JSON.stringify(registrySchema, null, 2)}\n`,
  );
  await writeFile(
    fromRoot("schemas", "source.schema.json"),
    `${JSON.stringify(sourceSchema, null, 2)}\n`,
  );
  await writeFile(
    fromRoot("schemas", "identifier-observation.schema.json"),
    `${JSON.stringify(identifierObservationSchema, null, 2)}\n`,
  );
  await writeFile(
    fromRoot("schemas", "authority.schema.json"),
    `${JSON.stringify(authoritySchema, null, 2)}\n`,
  );
  await writeFile(
    fromRoot("schemas", "registry-invalid.schema.json"),
    `${JSON.stringify(registryInvalidSchema, null, 2)}\n`,
  );
}

const registryRecordSchema = {
  type: "object",
  required: [
    "key",
    "countryCode",
    "partyId",
    "eMobilityId",
    "role",
    "status",
    "organization",
    "source",
    "metadata",
  ],
  properties: {
    key: { type: "string" },
    countryCode: { type: "string", pattern: EMI3_COUNTRY_CODE_PATTERN.source },
    partyId: { type: "string", pattern: EMI3_PARTY_ID_PATTERN.source },
    eMobilityId: { type: "string", pattern: EMI3_IDENTIFIER_PATTERN.source },
    role: { enum: ["CPO", "CSO", "EMSP", "NSP", "HUB", "OTHER"] },
    status: { enum: ["ACTIVE", "INACTIVE", "RESERVED", "REVOKED", "UNKNOWN"] },
    organization: { type: "object" },
    source: { type: "object" },
    metadata: { type: "object" },
  },
};

const registrySchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "RegistryDataset",
  type: "array",
  items: registryRecordSchema,
};

// The history is append-only, so every entry records when it was first and last
// detected. `supersededBy` is written by hand and must name a valid eMobility
// ID, or null when nothing replaced the identifier.
const historyFields = {
  required: ["firstDetectedAt", "lastDetectedAt", "supersededBy"],
  properties: {
    firstDetectedAt: { type: "string" },
    lastDetectedAt: { type: "string" },
    supersededBy: {
      anyOf: [{ type: "string", pattern: EMI3_IDENTIFIER_PATTERN.source }, { type: "null" }],
    },
  },
};

// Records excluded from the published datasets keep the registry record shape
// minus the identifier patterns, since the identifier is exactly what is wrong.
// Shared by the two row buckets: what was refused, and by which register.
const rowFields = {
  required: ["registryId", "code", "sourceValue", "message"],
  properties: {
    registryId: { type: "string" },
    code: { type: "string" },
    sourceValue: { type: "string" },
    message: { type: "string" },
  },
};

const registryInvalidSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "InvalidRegistryDataset",
  type: "object",
  required: ["generatedAt", "records", "rows", "outOfJurisdiction"],
  properties: {
    generatedAt: { type: "string" },
    rows: {
      type: "array",
      items: {
        type: "object",
        required: [...historyFields.required, ...rowFields.required],
        properties: { ...historyFields.properties, ...rowFields.properties },
      },
    },
    outOfJurisdiction: {
      type: "array",
      items: {
        type: "object",
        required: [...historyFields.required, ...rowFields.required, "countryCode"],
        properties: {
          ...historyFields.properties,
          ...rowFields.properties,
          countryCode: { type: "string", pattern: EMI3_COUNTRY_CODE_PATTERN.source },
        },
      },
    },
    records: {
      type: "array",
      items: {
        type: "object",
        required: [...historyFields.required, "reasons", "record"],
        properties: {
          ...historyFields.properties,
          reasons: {
            type: "array",
            minItems: 1,
            items: { enum: ["INVALID_COUNTRY", "INVALID_PARTY_ID"] },
          },
          record: {
            ...registryRecordSchema,
            properties: {
              ...registryRecordSchema.properties,
              countryCode: { type: "string" },
              partyId: { type: "string" },
              eMobilityId: { type: "string" },
            },
          },
        },
      },
    },
  },
};

const sourceSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "SourceSummaryDataset",
  type: "array",
  items: {
    type: "object",
    required: ["id", "name", "authority", "registry", "publication", "official", "reuse", "health"],
  },
};

const authoritySchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "AuthorityDefinition",
  type: "object",
  required: ["id", "name", "level", "jurisdictions", "homepageUrl"],
};

const identifierObservationSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "IdentifierObservationDataset",
  type: "array",
  items: {
    type: "object",
    required: [
      "key",
      "scheme",
      "countryCode",
      "partyId",
      "normalizedValue",
      "role",
      "status",
      "organization",
      "source",
      "confidence",
      "metadata",
    ],
    properties: {
      key: { type: "string" },
      scheme: {
        enum: [
          "EMI3_OPERATOR_ID",
          "EMI3_PROVIDER_ID",
          "OCPI_PARTY_ID",
          "OCN_PARTY_ID",
          "HUB_PARTY_ID",
          "NATIONAL_INTERNAL_ID",
          "EVSE_PREFIX",
          "UNKNOWN",
        ],
      },
      countryCode: { anyOf: [{ type: "string", pattern: "^[A-Z]{2}$" }, { type: "null" }] },
      partyId: { type: "string" },
      normalizedValue: { type: "string" },
      role: { enum: ["CPO", "CSO", "EMSP", "NSP", "HUB", "OTHER"] },
      status: { enum: ["ACTIVE", "INACTIVE", "RESERVED", "REVOKED", "UNKNOWN"] },
      organization: { type: "object" },
      source: { type: "object" },
      confidence: { type: "object" },
      metadata: { type: "object" },
    },
  },
};
