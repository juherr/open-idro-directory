import { z } from "zod";

export const afirevRecordSchema = z.object({
  prefixId: z.string(),
  name: z.string().nullable().optional(),
  amenageurName: z.string().nullable().optional(),
  exploitantName: z.string().nullable().optional(),
  type: z.string(),
  status: z.string(),
});

export const afirevResponseSchema = z.object({
  data: z.array(z.unknown()),
});

export type AfirevRecord = z.infer<typeof afirevRecordSchema>;
