import { describe, expect, it } from "vitest";
import { registryInvalidSchema, registrySchema } from "../../src/application/validate-registry.js";
import { observationKindSchema } from "../../src/domain/registry-record.js";

const OBSERVATION = {
  type: "object",
  required: ["kind", "observingJurisdiction"],
  properties: {
    kind: { enum: ["ASSIGNMENT", "CROSS_REGISTER_LISTING"] },
    observingJurisdiction: {
      anyOf: [{ type: "string", pattern: "^[A-Z]{2}$" }, { type: "null" }],
    },
  },
};

describe("registry JSON schemas", () => {
  it("describes the optional observation block of a record's source", () => {
    const source = registrySchema.items.properties.source;

    expect(source.properties.observation).toEqual(OBSERVATION);
    // Records published before the block existed stay valid.
    expect(source).not.toHaveProperty("required");
  });

  it("lists exactly the observation kinds the domain accepts", () => {
    expect(
      registrySchema.items.properties.source.properties.observation.properties.kind.enum,
    ).toEqual(observationKindSchema.options);
  });

  it("describes the same block on the records excluded from the datasets", () => {
    const record = registryInvalidSchema.properties.records.items.properties.record;

    expect(record.properties.source.properties.observation).toEqual(OBSERVATION);
  });
});
