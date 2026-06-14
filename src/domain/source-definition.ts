import { z } from "zod";

export const licenseStatusSchema = z.enum(["open", "permission-granted", "unknown", "restricted"]);
export type LicenseStatus = z.infer<typeof licenseStatusSchema>;

export const sourceDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  authorityName: z.string().min(1),
  jurisdictions: z.array(z.string().regex(/^[A-Z]{2}$/)).min(1),
  official: z.boolean(),
  homepageUrl: z.string().url(),
  registryUrl: z.string().url(),
  connector: z.string().min(1),
  enabled: z.boolean(),
  refreshSchedule: z.string().min(1),
  supportedRoles: z.array(z.enum(["CPO", "CSO", "EMSP", "OTHER"])).min(1),
  license: z.object({
    status: licenseStatusSchema,
    name: z.string().nullable(),
    url: z.string().url().nullable(),
  }),
  notes: z.string().optional(),
  safety: z
    .object({
      maxDeletionRatio: z.number().min(0).max(1).default(0.2),
      maxChangeRatio: z.number().min(0).max(1).default(0.5),
      maxParseErrorRatio: z.number().min(0).max(1).default(0.05),
    })
    .default({ maxDeletionRatio: 0.2, maxChangeRatio: 0.5, maxParseErrorRatio: 0.05 }),
});

export type SourceDefinition = z.infer<typeof sourceDefinitionSchema>;
