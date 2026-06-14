import { z } from "zod";

export const croIdroCsvRowSchema = z.object({
  companyName: z.string(),
  cpoIds: z.array(z.string()),
  emspIds: z.array(z.string()),
});

export type CroIdroCsvRow = z.infer<typeof croIdroCsvRowSchema>;
