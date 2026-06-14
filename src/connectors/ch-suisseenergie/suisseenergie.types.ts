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

export const suisseEnergiePageDataSchema = z.object({
  data: z.object({
    providers: z.object({
      nodes: z.array(suisseEnergieProviderSchema),
    }),
  }),
});

export type SuisseEnergieProvider = z.infer<typeof suisseEnergieProviderSchema>;
