import { z } from "zod";

export const traficomHtmlRowSchema = z.object({
  companyName: z.string(),
  cpoIds: z.array(z.string()),
  emspIds: z.array(z.string()),
  businessId: z.string().nullable(),
});

export type TraficomHtmlRow = z.infer<typeof traficomHtmlRowSchema>;
