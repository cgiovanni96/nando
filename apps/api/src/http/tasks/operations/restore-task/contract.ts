import { taskDtoFactory, taskResponseSchema } from "@api/http/tasks/contract/shared";

/** Esempio di task ripristinato: `deletedAt` e `restorableUntil` tornano null. */
export const restoredTaskResponseExample = taskResponseSchema.parse({
  ok: true,
  data: taskDtoFactory({
    version: 3,
    updatedAt: "2026-11-13T09:00:00.000Z",
  }),
});
