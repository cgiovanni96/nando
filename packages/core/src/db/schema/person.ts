import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const person = pgTable("person", {
  id: uuid("id").primaryKey(),
  displayName: text("display_name").notNull(),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});
