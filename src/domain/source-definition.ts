import { z } from "zod";

export const reuseStatusSchema = z.enum([
  "licensed",
  "statutory",
  "permission-granted",
  "restricted",
  "unspecified",
]);
export type ReuseStatus = z.infer<typeof reuseStatusSchema>;

const reuseReferenceSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
});

export const reuseSchema = z
  .object({
    status: reuseStatusSchema,
    legalBasis: reuseReferenceSchema.nullable(),
    licence: reuseReferenceSchema.nullable(),
    attributionNotice: z.string().min(1).nullable(),
    redistributionAllowed: z.boolean().nullable(),
    notes: z.string().min(1).nullable(),
  })
  .superRefine((reuse, context) => {
    if (reuse.status === "statutory" && !reuse.legalBasis) {
      context.addIssue({
        code: "custom",
        path: ["legalBasis"],
        message: "A statutory reuse status requires a legal basis.",
      });
    }
    if (reuse.status === "licensed" && !reuse.licence) {
      context.addIssue({
        code: "custom",
        path: ["licence"],
        message: "A licensed reuse status requires an explicit licence.",
      });
    }
  });

export const sourceDefinitionSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    authorityName: z.string().min(1),
    jurisdictions: z.array(z.string().regex(/^[A-Z]{2}$/)).min(1),
    official: z.boolean(),
    homepageUrl: z.string().url(),
    registryUrl: z.string().url(),
    machineReadableUrl: z.string().url().nullable(),
    verifiedAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
    connector: z.string().min(1),
    enabled: z.boolean(),
    refreshSchedule: z.string().min(1),
    supportedRoles: z.array(z.enum(["CPO", "CSO", "EMSP", "NSP", "HUB", "OTHER"])).min(1),
    reuse: reuseSchema,
    notes: z.string().optional(),
    safety: z
      .object({
        maxDeletionRatio: z.number().min(0).max(1).default(0.2),
        maxDeletionCount: z.number().int().min(0).default(5),
        maxChangeRatio: z.number().min(0).max(1).default(0.5),
        maxParseErrorRatio: z.number().min(0).max(1).default(0.05),
        acceptedDeletionKeys: z.array(z.string().min(1)).default([]),
      })
      .default({
        maxDeletionRatio: 0.2,
        maxDeletionCount: 5,
        maxChangeRatio: 0.5,
        maxParseErrorRatio: 0.05,
        acceptedDeletionKeys: [],
      }),
  })
  .strict();

export type SourceDefinition = z.infer<typeof sourceDefinitionSchema>;
