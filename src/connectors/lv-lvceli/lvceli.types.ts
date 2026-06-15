import { z } from "zod";

export const lvceliRowSchema = z.object({
  legalEntityName: z.string(),
  cpoIds: z.array(z.string()),
  emspIds: z.array(z.string()),
  email: z.string().nullable(),
  website: z.string().nullable(),
});

export type LvceliRow = z.infer<typeof lvceliRowSchema>;
