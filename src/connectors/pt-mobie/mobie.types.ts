import { z } from "zod";

export const mobieRowSchema = z.object({
  code: z.string(),
  partyId: z.string(),
  organizationName: z.string(),
  isEmsp: z.boolean(),
  isCpo: z.boolean(),
});

export type MobieRow = z.infer<typeof mobieRowSchema>;
