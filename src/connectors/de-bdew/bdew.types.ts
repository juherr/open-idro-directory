import { z } from "zod";

export const bdewApiCodeSchema = z.object({
  Id: z.number(),
  Code: z.string(),
  Company: z.string(),
});

export const bdewApiResponseSchema = z.object({
  Result: z.string(),
  Records: z.array(bdewApiCodeSchema),
  TotalRecordCount: z.number(),
});

export const bdewSnapshotSchema = z.object({
  cpo: z.array(bdewApiCodeSchema),
  emsp: z.array(bdewApiCodeSchema),
});

export type BdewApiCode = z.infer<typeof bdewApiCodeSchema>;
export type BdewSnapshot = z.infer<typeof bdewSnapshotSchema>;
