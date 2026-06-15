import { z } from "zod";

export const huIdroHtmlRowSchema = z.object({
  organizationName: z.string().min(1),
  taxNumber: z.string().nullable(),
  sourceValue: z.string().min(1),
  role: z.enum(["CPO", "EMSP"]),
});

export type HuIdroHtmlRow = z.infer<typeof huIdroHtmlRowSchema>;
