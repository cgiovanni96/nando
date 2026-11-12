import { eq, sql } from "drizzle-orm";
import type { Clock, Result } from "@nando/kernel";
import { err, ok } from "@nando/kernel";

import {
  mutationViolation,
  nameViolation,
  normalizeSpaceName,
  parentViolation,
  type Space,
  type SpaceKind,
} from "./domain";
import type { SpaceDatabase } from "./ports";
import { space } from "./schema";

export type SpaceCommandDeps = {
  db: SpaceDatabase;
  clock: Clock;
  ids: () => string;
};

export type CreateSpaceInput = {
  name: string;
  kind: SpaceKind;
  parentId: string | null;
};

export type RenameSpaceInput = {
  spaceId: string;
  name: string;
};

async function findSpace(db: SpaceDatabase, spaceId: string): Promise<Space | null> {
  const [row] = await db.select().from(space).where(eq(space.id, spaceId)).limit(1);
  return row ?? null;
}

export function createSpaceCommands({ db, clock, ids }: SpaceCommandDeps) {
  return {
    async create(input: CreateSpaceInput): Promise<Result<Space>> {
      const name = normalizeSpaceName(input.name);

      const invalidName = nameViolation(name);
      if (invalidName) return err(invalidName);

      if (input.parentId !== null) {
        const parent = await findSpace(db, input.parentId);

        if (!parent) {
          return err({ code: "not_found", message: "Space genitore non trovato." });
        }

        const invalidParent = parentViolation(parent, input.kind);
        if (invalidParent) return err(invalidParent);
      }

      const now = clock.now();
      const [created] = await db
        .insert(space)
        .values({
          id: ids(),
          name,
          kind: input.kind,
          parentId: input.parentId,
          completedAt: null,
          archivedAt: null,
          deletedAt: null,
          version: 1,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      if (!created) {
        return err({ code: "internal_error", message: "Errore interno." });
      }

      return ok(created);
    },

    async rename(input: RenameSpaceInput): Promise<Result<Space>> {
      const existing = await findSpace(db, input.spaceId);

      if (!existing) {
        return err({ code: "not_found", message: "Space non trovato." });
      }

      const invalidMutation = mutationViolation(existing);
      if (invalidMutation) return err(invalidMutation);

      const name = normalizeSpaceName(input.name);

      const invalidName = nameViolation(name);
      if (invalidName) return err(invalidName);

      const [renamed] = await db
        .update(space)
        .set({ name, version: existing.version + 1, updatedAt: clock.now() })
        .where(eq(space.id, input.spaceId))
        .returning();

      if (!renamed) {
        return err({ code: "not_found", message: "Space non trovato." });
      }

      return ok(renamed);
    },

    async archive(input: { spaceId: string }): Promise<Result<Space>> {
      const existing = await findSpace(db, input.spaceId);

      if (!existing || existing.deletedAt) {
        return err({ code: "not_found", message: "Space non trovato." });
      }

      if (existing.archivedAt) {
        return ok(existing);
      }

      const now = clock.now();
      await db.execute(sql`
        with recursive subtree as (
          select id from space where id = ${input.spaceId}
          union all
          select child.id
          from space child
          join subtree parent on child.parent_id = parent.id
        )
        update space
        set
          archived_at = ${now.toISOString()}::timestamptz,
          updated_at = ${now.toISOString()}::timestamptz,
          version = version + 1
        where id in (select id from subtree) and archived_at is null
      `);

      return ok({ ...existing, archivedAt: now, updatedAt: now, version: existing.version + 1 });
    },

    async unarchive(input: { spaceId: string }): Promise<Result<Space>> {
      const existing = await findSpace(db, input.spaceId);

      if (!existing || existing.deletedAt) {
        return err({ code: "not_found", message: "Space non trovato." });
      }

      if (!existing.archivedAt) {
        return ok(existing);
      }

      if (existing.parentId) {
        const [ancestor] = await db.execute<{ archived: boolean }>(sql`
          with recursive ancestors as (
            select id, parent_id, archived_at from space where id = ${existing.parentId}
            union all
            select parent.id, parent.parent_id, parent.archived_at
            from space parent
            join ancestors child on parent.id = child.parent_id
          )
          select exists(select 1 from ancestors where archived_at is not null) as archived
        `);

        if (ancestor?.archived) {
          return err({
            code: "domain_rule_violation",
            message: "Riattiva prima lo Space genitore archiviato.",
          });
        }
      }

      const now = clock.now();
      await db.execute(sql`
        with recursive subtree as (
          select id from space where id = ${input.spaceId}
          union all
          select child.id
          from space child
          join subtree parent on child.parent_id = parent.id
        )
        update space
        set
          archived_at = null,
          updated_at = ${now.toISOString()}::timestamptz,
          version = version + 1
        where id in (select id from subtree) and archived_at is not null
      `);

      return ok({ ...existing, archivedAt: null, updatedAt: now, version: existing.version + 1 });
    },
  };
}

export type SpaceCommands = ReturnType<typeof createSpaceCommands>;
