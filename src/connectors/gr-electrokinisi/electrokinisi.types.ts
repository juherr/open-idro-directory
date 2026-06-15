import { z } from "zod";

export const electrokinisiHtmlRowSchema = z.object({
  organizationName: z.string().nullable(),
  sourceValue: z.string().min(1),
  sourceRole: z.string().min(1),
  role: z.enum(["CPO", "EMSP", "OTHER"]),
  website: z.string().nullable(),
  email: z.string().nullable(),
});

export type ElectrokinisiHtmlRow = z.infer<typeof electrokinisiHtmlRowSchema>;
