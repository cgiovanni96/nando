import { TASK_STATUSES, TASK_TITLE_MAX_LENGTH } from "@nando/core";
import { z } from "zod";

import { successEnvelopeSchema, uuidV7Schema } from "@api/http/envelope";

export const EXAMPLE_COMMAND_ID = "0199a4c2-7a10-7000-8000-000000000001";
export const EXAMPLE_TASK_ID = "0199a4c2-7a10-7000-8000-000000000301";
export const EXAMPLE_TASK_SPACE_ID = "0199a4c2-7a10-7000-8000-000000000401";
export const EXAMPLE_TIMESTAMP = "2026-11-12T09:00:00.000Z";
export const EXAMPLE_DUE_AT = "2026-11-12T18:00:00.000Z";
export const EXAMPLE_TIME_ZONE = "Europe/Rome";

export const taskStatusSchema = z.enum(TASK_STATUSES);
export const taskTitleSchema = z.string().trim().min(1).max(TASK_TITLE_MAX_LENGTH);

/**
 * Schedule in ingresso (ADR-0004): `allDay` decide il tipo di `from` e `to`,
 * date `YYYY-MM-DD` oppure istanti ISO 8601. La timezone è quella del Task.
 */
export const scheduleInputSchema = z.discriminatedUnion("allDay", [
  z.object({ allDay: z.literal(true), from: z.iso.date().nullable(), to: z.iso.date() }),
  z.object({
    allDay: z.literal(false),
    from: z.iso.datetime().nullable(),
    to: z.iso.datetime(),
  }),
]);

/** Schedule in uscita: come l'ingresso, più la timezone IANA in cui si valuta. */
export const scheduleDtoSchema = z.discriminatedUnion("allDay", [
  z.object({
    allDay: z.literal(true),
    from: z.iso.date().nullable(),
    to: z.iso.date(),
    timeZone: z.string().min(1),
  }),
  z.object({
    allDay: z.literal(false),
    from: z.iso.datetime().nullable(),
    to: z.iso.datetime(),
    timeZone: z.string().min(1),
  }),
]);

export type ScheduleInputDto = z.infer<typeof scheduleInputSchema>;
export type ScheduleDto = z.infer<typeof scheduleDtoSchema>;

export const exampleSchedule: ScheduleDto = scheduleDtoSchema.parse({
  allDay: false,
  from: null,
  to: EXAMPLE_DUE_AT,
  timeZone: EXAMPLE_TIME_ZONE,
});

export const taskDtoSchema = z.object({
  id: z.uuid(),
  title: z.string().min(1),
  status: taskStatusSchema,
  schedule: scheduleDtoSchema.nullable(),
  timeZone: z.string().min(1),
  spaceId: z.uuid().nullable(),
  version: z.number().int().positive(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  deletedAt: z.iso.datetime().nullable(),
  restorableUntil: z.iso.datetime().nullable(),
});

export const taskIdParamsSchema = z.object({
  taskId: z.uuid(),
});

export const taskCommandRequestSchema = z.object({
  commandId: uuidV7Schema,
});

export const taskResponseSchema = successEnvelopeSchema(taskDtoSchema);

export type TaskDto = z.infer<typeof taskDtoSchema>;
export type TaskCommandRequest = z.infer<typeof taskCommandRequestSchema>;

export function taskDtoFactory(overrides: Partial<TaskDto> = {}): TaskDto {
  return taskDtoSchema.parse({
    id: EXAMPLE_TASK_ID,
    title: "Comprare il pane",
    status: "open",
    schedule: null,
    timeZone: EXAMPLE_TIME_ZONE,
    spaceId: null,
    version: 1,
    createdAt: EXAMPLE_TIMESTAMP,
    updatedAt: EXAMPLE_TIMESTAMP,
    deletedAt: null,
    restorableUntil: null,
    ...overrides,
  });
}

export function taskCommandRequestFactory(
  overrides: Partial<TaskCommandRequest> = {},
): TaskCommandRequest {
  return taskCommandRequestSchema.parse({
    commandId: EXAMPLE_COMMAND_ID,
    ...overrides,
  });
}

export const taskCommandRequestExample = taskCommandRequestFactory();

export const taskResponseExample = taskResponseSchema.parse({
  ok: true,
  data: taskDtoFactory(),
});
