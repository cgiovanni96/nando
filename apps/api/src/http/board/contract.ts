// Contratto wire della vista Board: schemi, factory ed esempio.

import { BOARD_STATUSES } from "@nando/core";
import { z } from "zod";

import { temporalStateSchema } from "@api/http/agenda/contract";
import { successEnvelopeSchema } from "@api/http/envelope";
import { EXAMPLE_TIME_ZONE, taskDtoFactory, taskDtoSchema } from "@api/http/tasks/contract/shared";

/** Una colonna per richiesta; `status` è obbligatorio. */
export const boardQuerySchema = z.object({
  status: z.enum(BOARD_STATUSES),
  spaceId: z.uuid().optional(),
  horizon: z.enum(["7", "15", "30"]).optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const boardItemDtoSchema = taskDtoSchema.extend({
  dueDate: z.iso.date().nullable(),
  temporalState: temporalStateSchema.nullable(),
  completedAt: z.iso.datetime().nullable(),
});

export const boardDataSchema = z.object({
  items: z.array(boardItemDtoSchema),
  nextCursor: z.string().nullable(),
});

export const boardResponseSchema = successEnvelopeSchema(boardDataSchema);

export type BoardQuery = z.infer<typeof boardQuerySchema>;
export type BoardItemDto = z.infer<typeof boardItemDtoSchema>;

export function boardItemDtoFactory(overrides: Partial<BoardItemDto> = {}): BoardItemDto {
  return boardItemDtoSchema.parse({
    ...taskDtoFactory(),
    dueDate: null,
    temporalState: null,
    completedAt: null,
    ...overrides,
  });
}

export const boardResponseExample = boardResponseSchema.parse({
  ok: true,
  data: {
    items: [
      boardItemDtoFactory({
        id: "0199a4c2-7a10-7000-8000-000000000304",
        title: "Pagare la bolletta",
        status: "open",
        schedule: { allDay: true, from: null, to: "2026-11-10", timeZone: EXAMPLE_TIME_ZONE },
        dueDate: "2026-11-10",
        temporalState: "overdue",
        completedAt: null,
      }),
      boardItemDtoFactory({
        id: "0199a4c2-7a10-7000-8000-000000000305",
        title: "Leggere il libro",
        status: "open",
        schedule: null,
        dueDate: null,
        temporalState: null,
        completedAt: null,
      }),
      boardItemDtoFactory({
        id: "0199a4c2-7a10-7000-8000-000000000306",
        title: "Ripasso settimanale",
        status: "completed",
        schedule: { allDay: true, from: null, to: "2026-11-12", timeZone: EXAMPLE_TIME_ZONE },
        dueDate: "2026-11-12",
        temporalState: null,
        completedAt: "2026-11-12T10:00:00.000Z",
      }),
    ],
    nextCursor: null,
  },
});
