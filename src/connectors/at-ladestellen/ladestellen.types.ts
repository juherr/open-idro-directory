import { z } from "zod";

export const ladestellenOperatorSchema = z.object({
  operatorId: z.string(),
  type: z.string(),
  organization: z.string().nullable().optional(),
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
});

export const ladestellenResponseSchema = z.array(z.unknown());

export type LadestellenOperator = z.infer<typeof ladestellenOperatorSchema>;
