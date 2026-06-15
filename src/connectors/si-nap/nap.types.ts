import { z } from "zod";

export const napRowSchema = z.object({
  organizationName: z.string(),
  emspId: z.string().nullable(),
  cpoId: z.string().nullable(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  country: z.string().nullable(),
  website: z.string().nullable(),
});

export type NapRow = z.infer<typeof napRowSchema>;
