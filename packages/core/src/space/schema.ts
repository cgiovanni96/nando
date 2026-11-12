import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { index, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const spaceKind = pgEnum("space_kind", ["area", "project", "resource"]);

export const space = pgTable(
  "space",
  {
    id: uuid("id").primaryKey(),
    name: text("name").notNull(),
    kind: spaceKind("kind").notNull(),
    parentId: uuid("parent_id").references((): AnyPgColumn => space.id, { onDelete: "restrict" }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("space_parent_id_idx").on(table.parentId),
    index("space_kind_idx").on(table.kind),
    index("space_archived_at_idx").on(table.archivedAt),
  ],
);

export type SpaceRow = typeof space.$inferSelect;
