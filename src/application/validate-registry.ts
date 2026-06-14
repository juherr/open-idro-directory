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
      role: { enum: ["CPO", "CSO", "EMSP", "OTHER"] },
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
