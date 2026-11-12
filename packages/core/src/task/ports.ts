import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import type { TaskSpaceSnapshot } from "./domain";

export type TaskDatabase = PostgresJsDatabase;

/** Transazione Drizzle compatibile con le query dei comandi. */
export type TaskTransaction = Parameters<Parameters<TaskDatabase["transaction"]>[0]>[0];

/** Connessione usata da un comando: il db del modulo o la transazione di idempotenza. */
export type TaskCommandDb = TaskDatabase | TaskTransaction;

/**
 * Porta verso Space: il modulo Task non importa query o schema dell'altro
 * modulo. Il composition root la implementa con `spaceModule.queries.get`.
 */
export interface TaskSpacePort {
  get(spaceId: string): Promise<TaskSpaceSnapshot | null>;
}
