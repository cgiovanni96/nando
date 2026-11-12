import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import type { InboxCursor, InboxItem } from "./domain";

export type SpaceDatabase = PostgresJsDatabase;

export type InboxSourceQuery = {
  cursor: InboxCursor | null;
  limit: number;
};

/**
 * Porta verso un modulo che possiede entità collocabili in uno Space.
 * L'Inbox è una vista: nessuno Space tecnico "inbox" esiste nei dati.
 *
 * La sorgente restituisce al massimo `limit` entità con `spaceId` nullo,
 * ordinate per `updatedAt` discendente, `entityType` e `id` ascendenti, e
 * riprende dopo `cursor` quando presente. La query dell'Inbox unisce le
 * sorgenti registrate e pagina il risultato.
 */
export interface InboxSource {
  listUnassigned(query: InboxSourceQuery): Promise<readonly InboxItem[]>;
}
