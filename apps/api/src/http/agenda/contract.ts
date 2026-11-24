// Contratto wire della vista Agenda: schemi, factory ed esempio.

import { z } from "zod";

import { successEnvelopeSchema } from "@api/http/envelope";
import {
  EXAMPLE_TIME_ZONE,
  scheduleDtoSchema,
  taskDtoFactory,
  taskDtoSchema,
} from "@api/http/tasks/contract/shared";

/** Giorni massimi, estremi inclusi, che una singola query può coprire. */
export const AGENDA_MAX_DAYS = 62;

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/** Numero di giorni di una data `YYYY-MM-DD`, calcolato in UTC. */
function dayNumber(date: string): number {
  return new Date(`${date}T00:00:00Z`).getTime() / MILLISECONDS_PER_DAY;
}

export const agendaQuerySchema = z
  .object({
    from: z.iso.date(),
    to: z.iso.date(),
    includeOverdue: z.enum(["true", "false"]).default("false"),
    cursor: z.string().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .refine((query) => dayNumber(query.from) <= dayNumber(query.to), {
    message: "L'inizio dell'intervallo non può essere dopo la fine.",
    path: ["to"],
  })
  .refine((query) => dayNumber(query.to) - dayNumber(query.from) < AGENDA_MAX_DAYS, {
    message: "L'intervallo non può superare 62 giorni.",
    path: ["to"],
  });

export const temporalStateSchema = z.enum(["upcoming", "current", "overdue"]);

export const agendaItemDtoSchema = taskDtoSchema.extend({
  schedule: scheduleDtoSchema,
  temporalState: temporalStateSchema,
  dueDate: z.iso.date(),
  startDate: z.iso.date().nullable(),
});

export const agendaDataSchema = z.object({
  items: z.array(agendaItemDtoSchema),
  nextCursor: z.string().nullable(),
});

export const agendaResponseSchema = successEnvelopeSchema(agendaDataSchema);

export type AgendaQuery = z.infer<typeof agendaQuerySchema>;
export type AgendaItemDto = z.infer<typeof agendaItemDtoSchema>;

export function agendaItemDtoFactory(overrides: Partial<AgendaItemDto> = {}): AgendaItemDto {
  return agendaItemDtoSchema.parse({
    ...taskDtoFactory(),
    schedule: { allDay: true, from: null, to: "2026-11-12", timeZone: EXAMPLE_TIME_ZONE },
    temporalState: "upcoming",
    dueDate: "2026-11-12",
    startDate: null,
    ...overrides,
  });
}

export const agendaResponseExample = agendaResponseSchema.parse({
  ok: true,
  data: {
    items: [
      agendaItemDtoFactory(),
      agendaItemDtoFactory({
        id: "0199a4c2-7a10-7000-8000-000000000302",
        title: "Vacanza",
        status: "in_progress",
        schedule: {
          allDay: true,
          from: "2026-11-10",
          to: "2026-11-14",
          timeZone: EXAMPLE_TIME_ZONE,
        },
        temporalState: "current",
        dueDate: "2026-11-14",
        startDate: "2026-11-10",
      }),
    ],
    nextCursor: null,
  },
});
