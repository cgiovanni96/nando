import { taskDtoFactory, taskResponseSchema } from "@api/http/tasks/contract/shared";

/** Esempio di task appena cancellato: la finestra di grazia scade 7 giorni dopo. */
export const deletedTaskResponseExample = taskResponseSchema.parse({
  ok: true,
  data: taskDtoFactory({
    version: 2,
    updatedAt: "2026-11-12T10:00:00.000Z",
    deletedAt: "2026-11-12T10:00:00.000Z",
    restorableUntil: "2026-11-19T10:00:00.000Z",
  }),
});
