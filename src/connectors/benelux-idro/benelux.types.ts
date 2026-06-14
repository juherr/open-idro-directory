import { z } from "zod";

export const beneluxCsvRowSchema = z.object({
  companyName: z.string(),
  cpoIds: z.array(z.string()),
  emspIds: z.array(z.string()),
  website: z.string().nullable(),
});

export type BeneluxCsvRow = z.infer<typeof beneluxCsvRowSchema>;
