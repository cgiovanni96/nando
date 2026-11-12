import type { InboxSource } from "@nando/core";
import type { ApiConfig, Database } from "@nando/platform";

/**
 * Dipendenze del processo api, costruite dal composition root.
 *
 * `config` e `db` sono le uniche dipendenze infrastrutturali; `inboxSources`
 * è la porta con cui i moduli che possiedono entità collocabili registrano la
 * vista Inbox, senza creare uno Space tecnico.
 */
export type ApiDeps = {
  config: ApiConfig;
  db: Database;
  inboxSources?: readonly InboxSource[];
};

/** Variabili Hono impostate dai middleware e lette dagli handler. */
export type ApiEnv = {
  Variables: {
    /** Id della richiesta, propagato o generato da `requestId`. */
    requestId: string;
    /** Owner applicativo impostato da `bearerAuth` dopo il token interno. */
    actorId: string;
  };
};
