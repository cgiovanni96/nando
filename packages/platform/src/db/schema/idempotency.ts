import { index, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const idempotency = pgTable(
  "idempotency",
  {
    actorId: uuid("actor_id").notNull(),
    commandName: text("command_name").notNull(),
    commandId: uuid("command_id").notNull(),
    payloadHash: text("payload_hash").notNull(),
    result: jsonb("result").$type<unknown>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.actorId, table.commandName, table.commandId] }),
    index("idempotency_expires_at_idx").on(table.expiresAt),
  ],
);
