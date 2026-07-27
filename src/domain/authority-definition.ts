import { z } from "zod";
import { authorityLevelSchema } from "./identifier-observation.js";

/** Territorial scope, as ISO 3166-1 alpha-2 codes. */
export const jurisdictionsSchema = z.array(z.string().regex(/^[A-Z]{2}$/)).min(1);

/**
 * The appointed organisation behind one or more registries. An authority is
 * described once and referenced by every source it operates, so that the same
 * organisation is never duplicated across descriptors.
 */
export const authorityDefinitionSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    level: authorityLevelSchema,
    jurisdictions: jurisdictionsSchema,
    homepageUrl: z.string().url(),
    notes: z.string().min(1).optional(),
  })
  .strict();

export type AuthorityDefinition = z.infer<typeof authorityDefinitionSchema>;
