import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

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
    dueAt: timestamp("due_at", { withTimezone: true }),
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
  ],
);

export type TaskRow = typeof task.$inferSelect;
export type TaskOccurrenceRow = typeof taskOccurrence.$inferSelect;
