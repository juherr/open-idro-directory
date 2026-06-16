import { z } from "zod";
import { parseEmobilityIdentifierInput } from "../domain/identifier.js";
import { ApiError } from "./errors.js";

const roleSchema = z.enum(["CPO", "CSO", "EMSP", "NSP", "HUB", "OTHER"]);
const statusSchema = z.enum(["ACTIVE", "INACTIVE", "RESERVED", "REVOKED", "UNKNOWN"]);
const authoritySchema = z.enum([
  "AUTHORITATIVE",
  "SUPRANATIONAL_DIRECTORY",
  "SECONDARY",
  "SELF_ASSERTED",
  "UNVERIFIED",
]);
const booleanStringSchema = z.enum(["true", "false"]).transform((value) => value === "true");

export const paginationSchema = z.object({
  cursor: z.string().max(500).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const partyListQuerySchema = paginationSchema
  .extend({
    country: z.string().length(2).transform(uppercase).optional(),
    partyId: z.string().min(1).max(10).transform(uppercase).optional(),
    emobilityId: z
      .string()
      .min(3)
      .max(20)
      .transform((value, context) => {
        const parsed = parseEmobilityIdentifierInput(value);
        if (!parsed) {
          context.addIssue({
            code: "custom",
            message: "Unsupported e-mobility identifier.",
          });
          return z.NEVER;
        }
        return parsed.emobilityId;
      })
      .optional(),
    role: roleSchema.optional(),
    status: statusSchema.optional(),
    authority: authoritySchema.optional(),
    source: z.string().min(1).max(80).optional(),
    hasConflict: booleanStringSchema.optional(),
    q: z.string().trim().min(2).max(80).transform(normalizeSearch).optional(),
    sort: z.enum(["countryCode", "partyId"]).default("countryCode"),
  })
  .strict();

export const observationQuerySchema = paginationSchema
  .extend({
    role: roleSchema.optional(),
    status: statusSchema.optional(),
    source: z.string().min(1).max(80).optional(),
    authority: authoritySchema.optional(),
    observationType: z.string().min(1).max(80).optional(),
  })
  .strict();

export const conflictQuerySchema = paginationSchema
  .extend({
    country: z.string().length(2).transform(uppercase).optional(),
    role: roleSchema.optional(),
    type: z.string().min(1).max(80).optional(),
    severity: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
    source: z.string().min(1).max(80).optional(),
  })
  .strict();

export function parseQuery<T>(schema: z.ZodType<T>, query: Record<string, string | undefined>) {
  const result = schema.safeParse(query);
  if (!result.success) {
    throw new ApiError(
      "cursor" in query ? 422 : 400,
      "INVALID_QUERY",
      "Invalid query parameters.",
      result.error.flatten(),
    );
  }
  return result.data;
}

export function parseCountryParty(countryCode: string, partyId: string) {
  const country = uppercase(countryCode);
  const party = uppercase(partyId);
  if (!/^[A-Z]{2}$/.test(country) || !/^[A-Z0-9*]{1,10}$/.test(party)) {
    throw new ApiError(422, "UNSUPPORTED_IDENTIFIER", "The requested identifier is not supported.");
  }
  return { countryCode: country, partyId: party };
}

export function normalizeSearch(value: string) {
  return value
    .normalize("NFKD")
    .replaceAll(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replaceAll(/\s+/g, " ")
    .trim();
}

export function escapeLike(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

function uppercase(value: string) {
  return value.toUpperCase();
}
