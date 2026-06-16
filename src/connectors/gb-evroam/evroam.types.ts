import { z } from "zod";

const optionalString = z.string().nullable().optional();

export const evroamRegisterItemSchema = z.object({
  title: z.string(),
  operatorId: optionalString,
  serviceProviderId: optionalString,
  operatorIdIE: optionalString,
  serviceProviderIdIE: optionalString,
  website: optionalString,
});

export const evroamRegisterResponseSchema = z.object({
  items: z.array(z.unknown()),
});

export type EvroamRegisterItem = z.infer<typeof evroamRegisterItemSchema>;
