import { and, eq, isNull } from "drizzle-orm";
import type { Clock, DomainError, Result } from "@nando/kernel";
import { err, ok } from "@nando/kernel";

import {
  dueAtViolation,
  normalizeTaskTitle,
  spaceViolation,
  TASK_STATUS_TARGETS,
  titleViolation,
  transitionViolation,
  type Task,
  type TaskStatus,
} from "./domain";
import { findTask } from "./mapper";
import type { TaskCommandDb, TaskDatabase, TaskSpacePort } from "./ports";
import { task, taskOccurrence } from "./schema";

export type TaskCommandDeps = {
  db: TaskDatabase;
  clock: Clock;
  ids: () => string;
  spacePort: TaskSpacePort;
};

export type CreateTaskInput = {
  title: string;
  spaceId: string | null;
  dueAt: Date | null;
};

export type UpdateTaskInput = {
  taskId: string;
  expectedVersion: number;
  title: string;
  spaceId: string | null;
  dueAt: Date | null;
};

export type TaskIdInput = {
  taskId: string;
};

function notFound(): DomainError {
  return { code: "not_found", message: "Task non trovato." };
}

function internalError(): DomainError {
  return { code: "internal_error", message: "Errore interno." };
}

function versionConflict(currentVersion: number): DomainError {
  return {
    code: "version_conflict",
    message: "Il task è stato modificato nel frattempo.",
    details: { currentVersion },
  };
}

function contentViolation(input: { title: string; dueAt: Date | null }): DomainError | null {
  return titleViolation(input.title) ?? dueAtViolation(input.dueAt);
}

async function spaceError(
  spacePort: TaskSpacePort,
  spaceId: string | null,
): Promise<DomainError | null> {
  if (spaceId === null) return null;
  return spaceViolation(await spacePort.get(spaceId));
}

async function runInTransaction<T>(
  db: TaskDatabase,
  tx: TaskCommandDb | undefined,
  fn: (conn: TaskCommandDb) => Promise<T>,
): Promise<T> {
  if (tx) return fn(tx);
  return db.transaction((inner) => fn(inner));
}

export function createTaskCommands({ db, clock, ids, spacePort }: TaskCommandDeps) {
  async function transition(
    taskId: string,
    target: TaskStatus,
    tx?: TaskCommandDb,
  ): Promise<Result<Task>> {
    const now = clock.now();

    return runInTransaction(db, tx, async (conn) => {
      const current = await findTask(conn, taskId);

      if (!current) return err(notFound());
      if (current.status === target) return ok(current);

      const violation = transitionViolation(current.status, target);
      if (violation) return err(violation);

      const [updated] = await conn
        .update(taskOccurrence)
        .set({ status: target, updatedAt: now })
        .where(eq(taskOccurrence.taskId, taskId))
        .returning({ id: taskOccurrence.id });

      if (!updated) return err(notFound());

      await conn
        .update(task)
        .set({ version: current.version + 1, updatedAt: now })
        .where(eq(task.id, taskId));

      const view = await findTask(conn, taskId);
      return view ? ok(view) : err(notFound());
    });
  }

  return {
    async create(input: CreateTaskInput, tx?: TaskCommandDb): Promise<Result<Task>> {
      const invalid = contentViolation(input);
      if (invalid) return err(invalid);

      const invalidSpace = await spaceError(spacePort, input.spaceId);
      if (invalidSpace) return err(invalidSpace);

      const title = normalizeTaskTitle(input.title);
      const now = clock.now();
      const taskId = ids();

      return runInTransaction(db, tx, async (conn) => {
        const [created] = await conn
          .insert(task)
          .values({
            id: taskId,
            title,
            spaceId: input.spaceId,
            version: 1,
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
          })
          .returning({ id: task.id });

        if (!created) return err(internalError());

        await conn.insert(taskOccurrence).values({
          id: ids(),
          taskId,
          status: "open",
          dueAt: input.dueAt,
          createdAt: now,
          updatedAt: now,
        });

        const view = await findTask(conn, taskId);
        return view ? ok(view) : err(internalError());
      });
    },

    async update(input: UpdateTaskInput, tx?: TaskCommandDb): Promise<Result<Task>> {
      const invalid = contentViolation(input);
      if (invalid) return err(invalid);

      const invalidSpace = await spaceError(spacePort, input.spaceId);
      if (invalidSpace) return err(invalidSpace);

      const title = normalizeTaskTitle(input.title);
      const now = clock.now();

      return runInTransaction(db, tx, async (conn) => {
        const current = await findTask(conn, input.taskId);

        if (!current) return err(notFound());
        if (current.version !== input.expectedVersion) {
          return err(versionConflict(current.version));
        }

        const [updated] = await conn
          .update(task)
          .set({
            title,
            spaceId: input.spaceId,
            version: current.version + 1,
            updatedAt: now,
          })
          .where(
            and(
              eq(task.id, input.taskId),
              eq(task.version, input.expectedVersion),
              isNull(task.deletedAt),
            ),
          )
          .returning({ id: task.id });

        if (!updated) {
          const latest = await findTask(conn, input.taskId);
          return err(versionConflict(latest?.version ?? current.version));
        }

        await conn
          .update(taskOccurrence)
          .set({ dueAt: input.dueAt, updatedAt: now })
          .where(eq(taskOccurrence.taskId, input.taskId));

        const view = await findTask(conn, input.taskId);
        return view ? ok(view) : err(notFound());
      });
    },

    async complete(input: TaskIdInput, tx?: TaskCommandDb): Promise<Result<Task>> {
      return transition(input.taskId, TASK_STATUS_TARGETS.complete, tx);
    },

    async skip(input: TaskIdInput, tx?: TaskCommandDb): Promise<Result<Task>> {
      return transition(input.taskId, TASK_STATUS_TARGETS.skip, tx);
    },

    async cancel(input: TaskIdInput, tx?: TaskCommandDb): Promise<Result<Task>> {
      return transition(input.taskId, TASK_STATUS_TARGETS.cancel, tx);
    },
  };
}

export type TaskCommands = ReturnType<typeof createTaskCommands>;
