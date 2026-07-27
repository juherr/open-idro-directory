import { sourceDescriptorSchema, type SourceDescriptor } from "../../domain/source-definition.js";

const LEGACY_KEYS = [
  "authorityName",
  "official",
  "homepageUrl",
  "registryUrl",
  "machineReadableUrl",
  "verifiedAt",
  "connector",
  "enabled",
  "refreshSchedule",
  "supportedRoles",
  "jurisdictions",
  "safety",
] as const;

const STRUCTURED_KEYS = ["authorityId", "authority", "registry", "publication"] as const;

/**
 * Translates a pre-#46 flat descriptor into the authority/registry/publication
 * shape. This is a migration concern, not a domain rule: the domain schema
 * describes only the current shape, and descriptors written against the old one
 * are lifted here on the way in.
 *
 * A descriptor mixing both shapes is returned untouched so the strict schema
 * rejects it rather than guessing which half is authoritative.
 */
export function liftLegacyDescriptor(input: unknown): unknown {
  if (typeof input !== "object" || input === null) return input;
  const value = input as Record<string, unknown>;
  const hasLegacy = LEGACY_KEYS.some((key) => key in value);
  const hasStructured = STRUCTURED_KEYS.some((key) => key in value);
  if (!hasLegacy || hasStructured) return input;

  // `official` decides the authority level, so a non-boolean must fail loudly
  // rather than silently downgrading the source to SECONDARY. YAML 1.2 parses
  // `yes`/`on` as strings, not booleans.
  if (typeof value.official !== "boolean") return input;

  const {
    authorityName,
    official,
    homepageUrl,
    registryUrl,
    machineReadableUrl,
    verifiedAt,
    connector,
    enabled,
    refreshSchedule,
    supportedRoles,
    jurisdictions,
    safety,
    ...rest
  } = value;

  return {
    ...rest,
    authority: {
      id: value.id,
      name: authorityName,
      level: official ? "AUTHORITATIVE" : "SECONDARY",
      jurisdictions,
      homepageUrl,
    },
    registry: {
      url: registryUrl,
      observationType: official ? "OFFICIAL_ASSIGNMENT" : "OFFICIAL_DIRECTORY_ENTRY",
      supportedRoles,
    },
    publication: {
      connector,
      machineReadableUrl,
      refreshSchedule,
      enabled,
      verifiedAt,
      ...(safety === undefined ? {} : { safety }),
    },
  };
}

/** Parses a descriptor document, accepting both the current and the pre-#46 shape. */
export function parseSourceDescriptor(document: unknown) {
  return sourceDescriptorSchema.safeParse(liftLegacyDescriptor(document));
}

export type { SourceDescriptor };
