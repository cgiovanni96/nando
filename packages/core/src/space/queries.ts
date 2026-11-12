import type { SQL } from "drizzle-orm";
import { and, desc, eq, isNull, lt } from "drizzle-orm";

import type { InboxCursor, InboxItem, Space, SpaceKind } from "./domain";
import type { InboxSource, SpaceDatabase } from "./ports";
import { space } from "./schema";

export type SpaceQueryDeps = {
  db: SpaceDatabase;
  inboxSources: readonly InboxSource[];
};

export type ListSpacesFilter = {
  kind?: SpaceKind;
  parentId?: string;
  includeArchived?: boolean;
  cursor?: string | null;
  limit?: number;
};

export type ListInboxFilter = {
  cursor?: string | null;
  limit?: number;
};

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function clampLimit(limit: number | undefined): number {
  if (limit === undefined || Number.isNaN(limit)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_LIMIT);
}

function encodeCursor(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decodeCursor(value: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function decodeInboxCursor(value: string): InboxCursor | null {
  const parsed = decodeCursor(value);

  if (
    !parsed ||
    typeof parsed.updatedAt !== "string" ||
    typeof parsed.entityType !== "string" ||
    typeof parsed.id !== "string"
  ) {
    return null;
  }

  return { updatedAt: parsed.updatedAt, entityType: parsed.entityType, id: parsed.id };
}

function compareInboxItems(a: InboxItem, b: InboxItem): number {
  const byUpdatedAt = b.updatedAt.getTime() - a.updatedAt.getTime();
  if (byUpdatedAt !== 0) return byUpdatedAt;

  const byType = a.entityType.localeCompare(b.entityType);
  if (byType !== 0) return byType;

  return a.id.localeCompare(b.id);
}

export function createSpaceQueries({ db, inboxSources }: SpaceQueryDeps) {
  return {
    async get(spaceId: string): Promise<Space | null> {
      const [row] = await db
        .select()
        .from(space)
        .where(and(eq(space.id, spaceId), isNull(space.deletedAt)))
        .limit(1);

      return row ?? null;
    },

    async list(
      filter: ListSpacesFilter = {},
    ): Promise<{ items: Space[]; nextCursor: string | null }> {
      const limit = clampLimit(filter.limit);
      const conditions: SQL[] = [isNull(space.deletedAt)];

      if (!filter.includeArchived) {
        conditions.push(isNull(space.archivedAt));
      }

      if (filter.kind) {
        conditions.push(eq(space.kind, filter.kind));
      }

      if (filter.parentId) {
        conditions.push(eq(space.parentId, filter.parentId));
      }

      if (filter.cursor) {
        const cursor = decodeCursor(filter.cursor);
        const cursorId = cursor?.id;

        if (typeof cursorId === "string" && UUID_PATTERN.test(cursorId)) {
          conditions.push(lt(space.id, cursorId));
        }
      }

      const rows = await db
        .select()
        .from(space)
        .where(and(...conditions))
        .orderBy(desc(space.id))
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;
      const last = items.at(-1);

      return {
        items,
        nextCursor: hasMore && last ? encodeCursor({ id: last.id }) : null,
      };
    },

    async listInbox(
      filter: ListInboxFilter = {},
    ): Promise<{ items: InboxItem[]; nextCursor: string | null }> {
      const limit = clampLimit(filter.limit);
      const cursor = filter.cursor ? decodeInboxCursor(filter.cursor) : null;

      const buckets = await Promise.all(
        inboxSources.map((source) => source.listUnassigned({ cursor, limit: limit + 1 })),
      );

      const merged = buckets.flatMap((bucket) => [...bucket]).toSorted(compareInboxItems);
      const hasMore = merged.length > limit;
      const items = hasMore ? merged.slice(0, limit) : merged;
      const last = items.at(-1);

      return {
        items,
        nextCursor:
          hasMore && last
            ? encodeCursor({
                updatedAt: last.updatedAt.toISOString(),
                entityType: last.entityType,
                id: last.id,
              })
            : null,
      };
    },
  };
}

export type SpaceQueries = ReturnType<typeof createSpaceQueries>;
