export const API_VERSION = "v1";
export const API_PREFIX = "/api/v1";
export const SCHEMA_VERSION = "1.0.0";
export const REPOSITORY_URL = "https://github.com/OWNER/open-idro-directory";
export const DISCLAIMER =
  "Open IDRO Directory is an independent aggregation project. It does not issue e-mobility identifiers and is not an authoritative source. Consumers must refer to the originating IDRO for legal, contractual, or operational verification.";

export const CACHE_CONTROL = {
  health: "public, max-age=60",
  dataset: "public, max-age=300, stale-while-revalidate=3600",
  default: "public, max-age=3600, stale-while-revalidate=86400",
};
