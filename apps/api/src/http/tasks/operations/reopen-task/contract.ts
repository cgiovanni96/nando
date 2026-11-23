import { z } from "zod";

import { uuidV7Schema } from "@api/http/envelope";
import {
  EXAMPLE_COMMAND_ID,
  taskDtoFactory,
  taskResponseSchema,
} from "@api/http/tasks/contract/shared";

export const reopenTaskRequestSchema = z.object({
  commandId: uuidV7Schema,
  /** Stato in cui torna l'occorrenza; default `open`. */
  to: z.enum(["open", "in_progress"]).default("open"),
});

export type ReopenTaskRequest = z.infer<typeof reopenTaskRequestSchema>;

export function reopenTaskRequestFactory(
  overrides: Partial<ReopenTaskRequest> = {},
): ReopenTaskRequest {
  return reopenTaskRequestSchema.parse({ commandId: EXAMPLE_COMMAND_ID, ...overrides });
}

export const reopenTaskRequestExample = reopenTaskRequestFactory();

export const reopenedTaskResponseExample = taskResponseSchema.parse({
  ok: true,
  data: taskDtoFactory({
    status: "open",
    version: 3,
    updatedAt: "2026-11-12T10:05:00.000Z",
  }),
});
