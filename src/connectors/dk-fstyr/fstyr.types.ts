import { z } from "zod";

export const fstyrHtmlRowSchema = z.object({
  cvr: z.string().nullable(),
  companyName: z.string(),
  cpoIds: z.array(z.string()),
  emspIds: z.array(z.string()),
});

export type FstyrHtmlRow = z.infer<typeof fstyrHtmlRowSchema>;
