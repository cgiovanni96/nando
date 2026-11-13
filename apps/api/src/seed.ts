import { space } from "@nando/core";
import { systemClock } from "@nando/kernel";
import type { Database } from "@nando/platform";

/**
 * Space iniziale della demo M1. L'ID è fisso perché il seed gira a ogni
 * migrate: l'insert idempotente non deve creare un secondo Space.
 */
export const INITIAL_SPACE_ID = "0199a4c2-7a10-7000-8000-000000000010";
export const INITIAL_SPACE_NAME = "Vita";

export async function seedInitialSpace(db: Database): Promise<void> {
  const now = systemClock.now();

  await db
    .insert(space)
    .values({
      id: INITIAL_SPACE_ID,
      name: INITIAL_SPACE_NAME,
      kind: "area",
      parentId: null,
      completedAt: null,
      archivedAt: null,
      deletedAt: null,
      version: 1,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();
}
