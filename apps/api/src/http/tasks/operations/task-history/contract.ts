import { z } from "zod";

import { successEnvelopeSchema } from "@api/http/envelope";

export const taskHistoryEntrySchema = z.object({
  kind: z.enum(["completed", "reopened", "skipped", "cancelled"]),
  at: z.iso.datetime(),
});

export const taskHistoryDataSchema = z.object({
  items: z.array(taskHistoryEntrySchema),
});

export const taskHistoryResponseSchema = successEnvelopeSchema(taskHistoryDataSchema);

export type TaskHistoryEntryDto = z.infer<typeof taskHistoryEntrySchema>;

export const taskHistoryResponseExample = taskHistoryResponseSchema.parse({
  ok: true,
  data: {
    items: [
      { kind: "completed", at: "2026-11-12T10:10:00.000Z" },
      { kind: "reopened", at: "2026-11-12T10:05:00.000Z" },
      { kind: "completed", at: "2026-11-12T10:00:00.000Z" },
    ],
  },
});
