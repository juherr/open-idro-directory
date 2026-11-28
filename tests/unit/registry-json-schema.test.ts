import { describe, expect, it } from "vitest";
import { registryInvalidSchema, registrySchema } from "../../src/application/validate-registry.js";
import {
  issuingConfirmationSchema,
  observationKindSchema,
} from "../../src/domain/registry-record.js";

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

  it("does not describe an issuing block on the records excluded from the datasets", () => {
    // Invalid records are never classified, so they never carry one.
    const record = registryInvalidSchema.properties.records.items.properties.record;

    expect(record.properties).not.toHaveProperty("issuing");
    expect(registrySchema.items.properties).toHaveProperty("issuing");
  });

  it("describes the optional issuing block of a record", () => {
    const record = registrySchema.items;

    expect(record.properties.issuing).toEqual({
      type: "object",
      required: ["country", "confirmation", "confirmedBy"],
      properties: {
        country: { type: "string", pattern: "^[A-Z]{2}$" },
        confirmation: {
          enum: [
            "CONFIRMED",
            "NOT_FOUND",
            "SOURCE_STALE",
            "SOURCE_UNAVAILABLE",
            "UNSUPPORTED_ROLE",
            "NO_ISSUING_SOURCE",
          ],
        },
        confirmedBy: { type: "array", items: { type: "string", minLength: 1 } },
      },
    });
    // Records published before the block existed stay valid.
    expect(record.required).not.toContain("issuing");
  });

  it("lists exactly the issuing confirmations the domain accepts", () => {
    expect(registrySchema.items.properties.issuing.properties.confirmation.enum).toEqual(
      issuingConfirmationSchema.options,
    );
  });
});
