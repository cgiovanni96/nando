import { createHash } from "node:crypto";

import { and, eq } from "drizzle-orm";

import type { Database } from "../db/client";
import { idempotency } from "../db/schema/idempotency";

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export class IdempotencyKeyReuseError extends Error {
  override name = "IdempotencyKeyReuseError";
}

export class IdempotencyInProgressError extends Error {
  override name = "IdempotencyInProgressError";
}

export function hashPayload(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

/**
 * Connessione transazionale passata a `execute`: le scritture del comando
 * condividono la transazione della riga di idempotenza.
 */
export type CommandTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export type IdempotentCommandInput<T> = {
  db: Database;
  actorId: string;
  commandName: string;
  commandId: string;
  payload: unknown;
  execute: (tx: CommandTransaction) => Promise<T>;
};

/**
 * Esegue un comando una sola volta per (actorId, commandName, commandId).
 * Un replay con lo stesso payload restituisce il risultato salvato; un
 * payload diverso sulla stessa chiave è un errore di contratto.
 *
 * `execute` riceve la transazione e deve usarla per le proprie scritture:
 * idempotenza e comando committano o falliscono insieme.
 */
export async function runIdempotentCommand<T>(input: IdempotentCommandInput<T>): Promise<T> {
  const payloadHash = hashPayload(input.payload);
  const now = new Date();

  return input.db.transaction(async (tx) => {
    const inserted = await tx
      .insert(idempotency)
      .values({
        actorId: input.actorId,
        commandName: input.commandName,
        commandId: input.commandId,
        payloadHash,
        result: null,
        expiresAt: new Date(now.getTime() + RETENTION_MS),
      })
      .onConflictDoNothing()
      .returning({ commandId: idempotency.commandId });

    if (inserted.length === 0) {
      const [existing] = await tx
        .select()
        .from(idempotency)
        .where(
          and(
            eq(idempotency.actorId, input.actorId),
            eq(idempotency.commandName, input.commandName),
            eq(idempotency.commandId, input.commandId),
          ),
        )
        .limit(1);

      if (!existing) {
        throw new Error("Riga di idempotenza assente dopo il conflitto.");
      }

      if (existing.payloadHash !== payloadHash) {
        throw new IdempotencyKeyReuseError(
          "Lo stesso commandId è già stato usato con un payload diverso.",
        );
      }

      if (existing.result === null) {
        throw new IdempotencyInProgressError("Il comando è ancora in esecuzione.");
      }

      return existing.result as T;
    }

    const result = await input.execute(tx);

    await tx
      .update(idempotency)
      .set({ result, updatedAt: new Date() })
      .where(
        and(
          eq(idempotency.actorId, input.actorId),
          eq(idempotency.commandName, input.commandName),
          eq(idempotency.commandId, input.commandId),
        ),
      );

    return result;
  });
}
