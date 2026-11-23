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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("task_occurrence_task_id_idx").on(table.taskId),
    index("task_occurrence_status_idx").on(table.status),
    check(
      "task_occurrence_status_check",
      sql`${table.status} in ('open', 'completed', 'skipped', 'cancelled')`,
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

export type TaskRow = typeof task.$inferSelect;
export type TaskOccurrenceRow = typeof taskOccurrence.$inferSelect;
