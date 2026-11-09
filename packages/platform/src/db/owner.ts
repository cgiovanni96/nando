import { eq } from "drizzle-orm";

import type { Database } from "./client";
import { user } from "./schema/user";

export async function ownerExists(db: Database, ownerId: string): Promise<boolean> {
  const rows = await db.select({ id: user.id }).from(user).where(eq(user.id, ownerId)).limit(1);

  return rows.length > 0;
}

export async function seedOwner(db: Database, ownerId: string): Promise<void> {
  await db.insert(user).values({ id: ownerId }).onConflictDoNothing();
}

export async function assertOwner(db: Database, ownerId: string): Promise<void> {
  if (await ownerExists(db, ownerId)) return;

  throw new Error(
    [
      `OWNER_USER_ID ${ownerId} non esiste nella tabella user.`,
      "Esegui `pnpm db:seed` con lo stesso OWNER_USER_ID prima di avviare api o worker.",
    ].join("\n"),
  );
}
