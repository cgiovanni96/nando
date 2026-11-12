import { z } from "zod";

import { uuidV7Schema } from "@api/http/envelope";
import {
  EXAMPLE_COMMAND_ID,
  EXAMPLE_TASK_SPACE_ID,
  taskDtoFactory,
  taskResponseSchema,
} from "@api/http/tasks/contract/shared";

export const moveTaskRequestSchema = z.object({
  commandId: uuidV7Schema,
  spaceId: z.uuid().nullable(),
});

export type MoveTaskRequest = z.infer<typeof moveTaskRequestSchema>;

export function moveTaskRequestFactory(overrides: Partial<MoveTaskRequest> = {}): MoveTaskRequest {
  return moveTaskRequestSchema.parse({
    commandId: EXAMPLE_COMMAND_ID,
    spaceId: EXAMPLE_TASK_SPACE_ID,
    ...overrides,
  });
}

export const moveTaskRequestExample = moveTaskRequestFactory();

export const movedTaskResponseExample = taskResponseSchema.parse({
  ok: true,
  data: taskDtoFactory({
    spaceId: EXAMPLE_TASK_SPACE_ID,
    version: 2,
    updatedAt: "2026-11-12T10:00:00.000Z",
  }),
});
