import { z } from "zod";

export const energimyndighetenWorkbookSchema = z.object({
  url: z.string().url(),
  contentBase64: z.string().min(1),
});

export const energimyndighetenSnapshotSchema = z.object({
  cpo: energimyndighetenWorkbookSchema,
  emsp: energimyndighetenWorkbookSchema,
});

export const energimyndighetenRowSchema = z.object({
  sourceValue: z.string(),
  organizationName: z.string().nullable(),
  role: z.enum(["CPO", "EMSP"]),
  sourceUrl: z.string().url(),
});

export type EnergimyndighetenSnapshot = z.infer<typeof energimyndighetenSnapshotSchema>;
export type EnergimyndighetenRow = z.infer<typeof energimyndighetenRowSchema>;
