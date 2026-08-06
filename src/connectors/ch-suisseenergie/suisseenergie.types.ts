import { z } from "zod";

export const suisseEnergieProviderSchema = z.object({
  node_locale: z.string(),
  digitId: z.string(),
  CPO: z.boolean(),
  EMP: z.boolean(),
  organization: z.object({
    companyName: z.string(),
    website: z.string().nullable(),
  }),
});

/**
 * One organization row of the register as published in the Astro island
 * payload. `ID`, `CPO`, and `EMP` are index-aligned: an organization holding
 * several identifiers repeats its role flags per identifier.
 */
export const suisseEnergieToolProviderSchema = z.object({
  company: z.string(),
  website: z.string().nullish(),
  ID: z.array(z.string()),
  CPO: z.array(z.boolean()),
  EMP: z.array(z.boolean()),
});

export const suisseEnergieRegisterElementSchema = z.object({
  frontendElementName: z.literal("DigitIDRegister"),
  node_locale: z.string().nullish(),
  toolData: z.object({
    providers: z.array(suisseEnergieToolProviderSchema),
  }),
});

export type SuisseEnergieProvider = z.infer<typeof suisseEnergieProviderSchema>;
export type SuisseEnergieToolProvider = z.infer<typeof suisseEnergieToolProviderSchema>;
