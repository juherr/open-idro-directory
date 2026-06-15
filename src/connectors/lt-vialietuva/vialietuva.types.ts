import { z } from "zod";

export const vialietuvaLocationSchema = z.object({
  country_code: z.string(),
  party_id: z.string(),
  operator: z
    .object({
      name: z.string().optional(),
      website: z.string().optional(),
    })
    .optional(),
  owner: z
    .object({
      name: z.string().optional(),
      website: z.string().optional(),
    })
    .optional(),
});

export type VialietuvaLocation = z.infer<typeof vialietuvaLocationSchema>;
