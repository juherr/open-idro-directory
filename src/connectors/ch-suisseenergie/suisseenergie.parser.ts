import type { ParseOutput } from "../connector.js";
import type { ValidationIssue } from "../../domain/validation-issue.js";
import {
  suisseEnergieRegisterElementSchema,
  type SuisseEnergieProvider,
  type SuisseEnergieToolProvider,
} from "./suisseenergie.types.js";

const DEFAULT_LOCALE = "fr";

/**
 * SuisseEnergie serves the register from an Astro page that embeds its whole
 * content tree in the `props` attribute of an `<astro-island>` element. The
 * register itself is the Contentful element named `DigitIDRegister`.
 */
export function parseSuisseEnergieHtml(body: string): ParseOutput<SuisseEnergieProvider> {
  const warnings: ValidationIssue[] = [];
  const errors: ValidationIssue[] = [];

  for (const payload of body.matchAll(/<astro-island\b[^>]*\sprops="([^"]*)"/gi)) {
    let decoded: unknown;
    try {
      // The props root is the value of an implicit plain-value pair: only its
      // members carry the `[type, value]` encoding.
      decoded = decodeAstroProps([0, JSON.parse(decodeEntities(payload[1] ?? ""))]);
    } catch (error) {
      return {
        records: [],
        warnings,
        errors: [
          invalidPayload(
            `Unreadable SuisseEnergie island payload: ${
              error instanceof Error ? error.message : String(error)
            }`,
          ),
        ],
      };
    }

    const element = findRegisterElement(decoded);
    if (!element) continue;

    const parsed = suisseEnergieRegisterElementSchema.safeParse(element);
    if (!parsed.success) {
      return {
        records: [],
        warnings,
        errors: [
          invalidPayload(`Unexpected SuisseEnergie register shape: ${parsed.error.message}`),
        ],
      };
    }

    const locale = parsed.data.node_locale ?? DEFAULT_LOCALE;
    const records = parsed.data.toolData.providers.flatMap((provider) =>
      toProviderRecords(provider, locale, warnings),
    );
    return { records, warnings, errors };
  }

  return {
    records: [],
    warnings,
    errors: [
      {
        severity: "error",
        code: "SUISSEENERGIE_REGISTER_NOT_FOUND",
        message: "The SuisseEnergie register element was not found in the HTML page.",
      },
    ],
  };
}

function toProviderRecords(
  provider: SuisseEnergieToolProvider,
  locale: string,
  warnings: ValidationIssue[],
): SuisseEnergieProvider[] {
  return provider.ID.flatMap((digitId, index) => {
    const cpo = provider.CPO[index];
    const emp = provider.EMP[index];
    if (cpo === undefined || emp === undefined) {
      warnings.push({
        severity: "warning",
        code: "SUISSEENERGIE_MISSING_ROLE_FLAGS",
        message: `SuisseEnergie identifier ${digitId} of ${provider.company} has no CPO or EMP flag.`,
      });
      return [];
    }
    return [
      {
        node_locale: locale,
        digitId,
        CPO: cpo,
        EMP: emp,
        organization: {
          companyName: provider.company,
          website: provider.website ?? null,
        },
      },
    ];
  });
}

function invalidPayload(message: string): ValidationIssue {
  return { severity: "error", code: "SUISSEENERGIE_INVALID_PAYLOAD", message };
}

function findRegisterElement(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findRegisterElement(item);
      if (found) return found;
    }
    return null;
  }
  if (!isRecord(value)) return null;
  if (value["frontendElementName"] === "DigitIDRegister") return value;
  for (const child of Object.values(value)) {
    const found = findRegisterElement(child);
    if (found) return found;
  }
  return null;
}

/**
 * Astro serializes every prop as a `[type, value]` pair. This payload only uses
 * plain values (`0`) and arrays (`1`); richer types (Date, Map, …) are handed
 * back as-is so the schema rejects them instead of the parser guessing.
 */
function decodeAstroProps(value: unknown): unknown {
  if (!Array.isArray(value) || value.length !== 2 || typeof value[0] !== "number") return value;
  const [type, payload] = value;
  if (type === 1) return Array.isArray(payload) ? payload.map(decodeAstroProps) : payload;
  if (type !== 0) return payload;
  if (Array.isArray(payload)) return payload.map(decodeAstroProps);
  if (isRecord(payload)) {
    return Object.fromEntries(
      Object.entries(payload).map(([key, entry]) => [key, decodeAstroProps(entry)]),
    );
  }
  return payload;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

// Entities are decoded in a single pass so that an escaped entity in the
// register content (`&amp;quot;`) cannot turn into markup and corrupt the JSON.
function decodeEntities(value: string) {
  return value.replace(
    /&(?:#x([0-9a-f]+)|#(\d+)|(amp|apos|gt|lt|nbsp|quot));/gi,
    (match, hex: string | undefined, code: string | undefined, name: string | undefined) => {
      if (hex) return String.fromCodePoint(Number.parseInt(hex, 16));
      if (code) return String.fromCodePoint(Number.parseInt(code, 10));
      return NAMED_ENTITIES[(name ?? "").toLowerCase()] ?? match;
    },
  );
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"',
};
