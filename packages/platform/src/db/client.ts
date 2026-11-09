import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

export type Database = PostgresJsDatabase;

export type DatabaseHandle = {
  db: Database;
  close: () => Promise<void>;
};

export function createDatabase(url: string): DatabaseHandle {
  const client = postgres(url, { max: 10 });
  const db = drizzle(client);

  return {
    db,
    close: async () => {
      await client.end({ timeout: 5 });
    },
  };
}
