import { z } from "zod";

export const tiiRowSchema = z.object({
  legalEntityName: z.string(),
  tradingName: z.string().nullable(),
  idroIssuedPartyId: z.string(),
  ocpiPartyIds: z.array(z.string()),
  isCpo: z.boolean(),
  isEmsp: z.boolean(),
});

export type TiiRow = z.infer<typeof tiiRowSchema>;
