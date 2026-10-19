import { z } from "zod";

export const croIdroHtmlRowSchema = z.object({
  companyName: z.string(),
  cpoIds: z.array(z.string()),
  emspIds: z.array(z.string()),
});

export type CroIdroHtmlRow = z.infer<typeof croIdroHtmlRowSchema>;
