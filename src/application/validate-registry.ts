import { readFile, writeFile, mkdir } from "node:fs/promises";
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
}

const registrySchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "RegistryDataset",
  type: "array",
  items: {
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
      countryCode: { type: "string", pattern: "^[A-Z]{2}$" },
      partyId: { type: "string" },
      eMobilityId: { type: "string" },
      role: { enum: ["CPO", "CSO", "EMSP", "NSP", "HUB", "OTHER"] },
      status: { enum: ["ACTIVE", "INACTIVE", "RESERVED", "REVOKED", "UNKNOWN"] },
      organization: { type: "object" },
      source: { type: "object" },
      metadata: { type: "object" },
    },
  },
};

const sourceSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "SourceDefinition",
  type: "object",
  required: [
    "id",
    "name",
    "authorityName",
    "jurisdictions",
    "official",
    "homepageUrl",
    "registryUrl",
    "connector",
    "enabled",
    "refreshSchedule",
    "supportedRoles",
    "license",
  ],
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
