import { uuidv7 } from "uuidv7";

/**
 * `commandId` del client: UUIDv7, generato una volta per intenzione.
 * Va riusato nei retry con lo stesso payload; il server deduplica per
 * (actorId, commandName, commandId).
 */
export function newCommandId(): string {
  return uuidv7();
}
