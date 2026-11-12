import { and, desc, eq, isNull, lt } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

import { clampLimit, decodeIdCursor, encodeCursor } from "../db/cursor";
import type { Task, TaskStatus } from "./domain";
import { findTask, taskViewColumns } from "./mapper";
import type { TaskDatabase } from "./ports";
import { task, taskOccurrence } from "./schema";

export type TaskQueryDeps = {
  db: TaskDatabase;
};

export type ListTasksFilter = {
  /** `null` filtra l'Inbox; `undefined` non filtra. */
  spaceId?: string | null;
  status?: TaskStatus;
  cursor?: string | null;
  limit?: number;
};

export function createTaskQueries({ db }: TaskQueryDeps) {
  return {
    async get(taskId: string): Promise<Task | null> {
      return findTask(db, taskId);
    },

    async list(
      filter: ListTasksFilter = {},
    ): Promise<{ items: Task[]; nextCursor: string | null }> {
      const limit = clampLimit(filter.limit);
      const conditions: SQL[] = [isNull(task.deletedAt)];

      if (filter.spaceId === null) {
        conditions.push(isNull(task.spaceId));
      } else if (filter.spaceId) {
        conditions.push(eq(task.spaceId, filter.spaceId));
      }

      if (filter.status) {
        conditions.push(eq(taskOccurrence.status, filter.status));
      }

      if (filter.cursor) {
        const cursorId = decodeIdCursor(filter.cursor);

        if (cursorId) {
          conditions.push(lt(task.id, cursorId));
        }
      }

      const rows = await db
        .select(taskViewColumns)
        .from(task)
        .innerJoin(taskOccurrence, eq(taskOccurrence.taskId, task.id))
        .where(and(...conditions))
        .orderBy(desc(task.id))
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;
      const last = items.at(-1);

      return {
        items,
        nextCursor: hasMore && last ? encodeCursor({ id: last.id }) : null,
      };
    },
  };
}

export type TaskQueries = ReturnType<typeof createTaskQueries>;
