import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { space } from "../space/schema";
import type { TaskStatus } from "./domain";

// Task e Space vivono entrambi in packages/core: la FK è intra-package
// secondo ADR-0011. Il modulo Task non legge la tabella Space fuori da questa
// dichiarazione; esistenza e scrivibilità passano da TaskSpacePort.
export const task = pgTable(
  "task",
  {
    id: uuid("id").primaryKey(),
    title: text("title").notNull(),
    spaceId: uuid("space_id").references(() => space.id, { onDelete: "restrict" }),
    // Timezone IANA del Task (ADR-0004): all-day e confini di giorno si
    // valutano qui. Alla creazione arriva da OWNER_TIME_ZONE.
    timeZone: text("time_zone").notNull(),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("task_space_id_idx").on(table.spaceId),
    index("task_deleted_at_idx").on(table.deletedAt),
  ],
);

export const taskOccurrence = pgTable(
  "task_occurrence",
  {
    id: uuid("id").primaryKey(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => task.id, { onDelete: "restrict" }),
    status: text("status").$type<TaskStatus>().notNull().default("open"),
    // Schedule (ADR-0004): date locali se all-day, istanti altrimenti; mai
    // misti. Tutte nulle = occorrenza senza Schedule (Inbox/backlog).
    allDay: boolean("all_day").notNull().default(false),
    startDate: date("start_date", { mode: "string" }),
    endDate: date("end_date", { mode: "string" }),
    startAt: timestamp("start_at", { withTimezone: true }),
    endAt: timestamp("end_at", { withTimezone: true }),
    // Identità dell'azione (ADR-0003): nasce al primo completamento e si
    // riusa se l'occorrenza viene completata di nuovo dopo una rettifica.
    activityId: uuid("activity_id"),
    // Quando l'occorrenza è stata saltata o cancellata; per lo storico.
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("task_occurrence_task_id_idx").on(table.taskId),
    index("task_occurrence_status_idx").on(table.status),
    check(
      "task_occurrence_status_check",
      sql`${table.status} in ('open', 'in_progress', 'completed', 'skipped', 'cancelled')`,
    ),
    check(
      "task_occurrence_schedule_check",
      sql`(${table.endDate} is null and ${table.endAt} is null and ${table.startDate} is null and ${table.startAt} is null)
        or (${table.allDay} and ${table.endDate} is not null and ${table.endAt} is null and ${table.startAt} is null
          and (${table.startDate} is null or ${table.startDate} <= ${table.endDate}))
        or (not ${table.allDay} and ${table.endAt} is not null and ${table.endDate} is null and ${table.startDate} is null
          and (${table.startAt} is null or ${table.startAt} <= ${table.endAt}))`,
    ),
  ],
);

/**
 * Completamento di un'occorrenza (ADR-0004): fatto datato e append-only. Non
 * si cancella; una riapertura aggiunge una `task_rectification`.
 */
export const taskCompletion = pgTable(
  "task_completion",
  {
    id: uuid("id").primaryKey(),
    occurrenceId: uuid("occurrence_id")
      .notNull()
      .references(() => taskOccurrence.id, { onDelete: "restrict" }),
    activityId: uuid("activity_id").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    provenance: text("provenance").$type<"manual">().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("task_completion_occurrence_id_idx").on(table.occurrenceId),
    check("task_completion_provenance_check", sql`${table.provenance} in ('manual')`),
  ],
);

/** Rettifica che annulla un completamento (ADR-0003): l'originale resta. */
export const taskRectification = pgTable(
  "task_rectification",
  {
    id: uuid("id").primaryKey(),
    completionId: uuid("completion_id")
      .notNull()
      .references(() => taskCompletion.id, { onDelete: "restrict" }),
    action: text("action").$type<"revert">().notNull(),
    reason: text("reason"),
    provenance: text("provenance").$type<"manual">().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Un completamento si annulla una volta sola.
    uniqueIndex("task_rectification_completion_id_idx").on(table.completionId),
    check("task_rectification_action_check", sql`${table.action} in ('revert')`),
    check("task_rectification_provenance_check", sql`${table.provenance} in ('manual')`),
  ],
);

export type TaskRow = typeof task.$inferSelect;
export type TaskOccurrenceRow = typeof taskOccurrence.$inferSelect;
