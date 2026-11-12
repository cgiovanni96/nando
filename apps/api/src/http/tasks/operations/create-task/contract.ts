import { z } from "zod";

import { uuidV7Schema } from "../../../envelope";
import { EXAMPLE_COMMAND_ID, taskTitleSchema } from "../../contract/shared";

export const createTaskRequestSchema = z.object({
  commandId: uuidV7Schema,
  title: taskTitleSchema,
  spaceId: z.uuid().nullable(),
  dueAt: z.iso.datetime().nullable(),
});

export type CreateTaskRequest = z.infer<typeof createTaskRequestSchema>;

export function createTaskRequestFactory(
  overrides: Partial<CreateTaskRequest> = {},
): CreateTaskRequest {
  return createTaskRequestSchema.parse({
    commandId: EXAMPLE_COMMAND_ID,
    title: "Comprare il pane",
    spaceId: null,
    dueAt: null,
    ...overrides,
  });
}

export const createTaskRequestExample = createTaskRequestFactory();
