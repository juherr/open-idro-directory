import { z } from "zod";
import {
  authorityDefinitionSchema,
  jurisdictionsSchema,
  type AuthorityDefinition,
} from "./authority-definition.js";
import { observationTypeSchema } from "./identifier-observation.js";
import { registryRoleSchema } from "./registry-record.js";

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

const safetySchema = z
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
  });

/**
 * The register operated by an authority: what it publishes and for whom. Its
 * jurisdictions default to the authority's and may only narrow them.
 */
export const registryDescriptorSchema = z
  .object({
    url: z.url(),
    observationType: observationTypeSchema,
    supportedRoles: z.array(registryRoleSchema).min(1),
    jurisdictions: jurisdictionsSchema.optional(),
  })
  .strict();
export type RegistryDescriptor = z.infer<typeof registryDescriptorSchema>;

/**
 * The technical resource a connector consumes. Several publications may expose
 * the same registry, so freshness and safety belong here rather than to the
 * authority.
 */
export const publicationDescriptorSchema = z
  .object({
    connector: z.string().min(1),
    machineReadableUrl: z.url().nullable(),
    refreshSchedule: z.string().min(1),
    enabled: z.boolean(),
    verifiedAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
    safety: safetySchema,
  })
  .strict();
export type PublicationDescriptor = z.infer<typeof publicationDescriptorSchema>;

export const sourceDescriptorSchema = z
  .object({
    id: z.string().min(1),
    authorityId: z.string().min(1).optional(),
    authority: authorityDefinitionSchema.optional(),
    name: z.string().min(1),
    registry: registryDescriptorSchema,
    publication: publicationDescriptorSchema,
    reuse: reuseSchema,
    notes: z.string().optional(),
  })
  .strict()
  .superRefine((descriptor, context) => {
    if (Boolean(descriptor.authorityId) === Boolean(descriptor.authority)) {
      context.addIssue({
        code: "custom",
        path: ["authorityId"],
        message:
          "A source must reference exactly one authority, either through authorityId or an inline authority.",
      });
    }
  });

export type SourceDescriptor = z.infer<typeof sourceDescriptorSchema>;

/** A descriptor whose authority reference has been resolved to a definition. */
export type SourceDefinition = Omit<SourceDescriptor, "authorityId" | "authority"> & {
  authority: AuthorityDefinition;
};

export function resolveSourceDefinitions(
  descriptors: SourceDescriptor[],
  authorities: AuthorityDefinition[],
): SourceDefinition[] {
  const byId = new Map<string, AuthorityDefinition>();
  for (const authority of authorities) {
    if (byId.has(authority.id)) {
      throw new Error(`Duplicate authority id ${authority.id} in the authority catalog.`);
    }
    byId.set(authority.id, authority);
  }
  // An inline authority is local to its source, so its id must not collide with a
  // catalogued one: downstream consumers key authorities by id and the loser would
  // be silently overwritten. Sources that share an authority use authorityId.
  for (const descriptor of descriptors) {
    if (!descriptor.authority) continue;
    if (byId.has(descriptor.authority.id)) {
      throw new Error(
        `Source ${descriptor.id} declares an inline authority whose id ${descriptor.authority.id} is already defined elsewhere.`,
      );
    }
    byId.set(descriptor.authority.id, descriptor.authority);
  }

  return descriptors.map((descriptor) => {
    const authority =
      descriptor.authority ??
      (descriptor.authorityId ? byId.get(descriptor.authorityId) : undefined);
    if (!authority) {
      throw new Error(
        `Source ${descriptor.id} references unknown authority ${descriptor.authorityId}.`,
      );
    }

    const outside = (descriptor.registry.jurisdictions ?? []).filter(
      (jurisdiction) => !authority.jurisdictions.includes(jurisdiction),
    );
    if (outside.length > 0) {
      throw new Error(
        `Source ${descriptor.id} claims jurisdictions outside authority ${authority.id}: ${outside.join(", ")}.`,
      );
    }

    const { authorityId: _authorityId, authority: _inline, ...rest } = descriptor;
    return { ...rest, authority };
  });
}

/** Effective territorial scope: the registry narrows the authority, never widens it. */
export function sourceJurisdictions(source: SourceDefinition): string[] {
  return source.registry.jurisdictions ?? source.authority.jurisdictions;
}

/**
 * Whether records from this source come from the organisation appointed to
 * assign the identifiers. Replaces the former `official` boolean.
 */
export function isAuthoritative(source: SourceDefinition): boolean {
  return source.authority.level === "AUTHORITATIVE";
}
