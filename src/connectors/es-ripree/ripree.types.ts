import { z } from "zod";

export const ripreeXmlRowSchema = z.object({
  document: z.string().nullable(),
  sourceValue: z.string(),
  companyType: z.string(),
  organizationName: z.string(),
  address: z.string().nullable(),
  country: z.string().nullable(),
  autonomousCommunity: z.string().nullable(),
  province: z.string().nullable(),
  municipality: z.string().nullable(),
  postalCode: z.string().nullable(),
  website: z.string().nullable(),
});

export type RipreeXmlRow = z.infer<typeof ripreeXmlRowSchema>;
