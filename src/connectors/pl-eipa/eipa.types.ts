import { z } from "zod";

export const eipaCsvRowSchema = z.object({
  organizationName: z.string(),
  cpoId: z.string().nullable(),
  emspId: z.string().nullable(),
  city: z.string().nullable(),
  country: z.string().nullable(),
  website: z.string().nullable(),
  registeredAt: z.string().nullable(),
});

export type EipaCsvRow = z.infer<typeof eipaCsvRowSchema>;
