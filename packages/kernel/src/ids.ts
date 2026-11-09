import { uuidv7 } from "uuidv7";

export type EntityId = string & { readonly __brand: "EntityId" };

export function newId(): EntityId {
  return uuidv7() as EntityId;
}
