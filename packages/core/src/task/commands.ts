import { and, eq, isNull } from "drizzle-orm";
import type { Clock, DomainError, Result } from "@nando/kernel";
import { err, ok } from "@nando/kernel";

import {
  dueAtViolation,
  normalizeTaskTitle,
  restoreViolation,
  spaceViolation,
  TASK_STATUS_TARGETS,
  titleViolation,
  transitionViolation,
  type Task,
  type TaskStatus,
} from "./domain";
import { findTask, findTaskIncludingDeleted } from "./mapper";
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
  dueAtHasTime: boolean;
};

export type UpdateTaskInput = {
  taskId: string;
  expectedVersion: number;
  title: string;
  spaceId: string | null;
  dueAt: Date | null;
  dueAtHasTime: boolean;
};

export type TaskIdInput = {
  taskId: string;
};

export type MoveTaskInput = {
  taskId: string;
  spaceId: string | null;
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

      // ADR-0002: l'archivio rende read-only l'entità. Il controllo è qui,
      // dopo il no-op idempotente: un comando che non scrive non viola nulla.
      const invalidSpace = await spaceError(spacePort, current.spaceId);
      if (invalidSpace) return err(invalidSpace);

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
          dueHasTime: input.dueAt !== null && input.dueAtHasTime,
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
          .set({
            dueAt: input.dueAt,
            dueHasTime: input.dueAt !== null && input.dueAtHasTime,
            updatedAt: now,
          })
          .where(eq(taskOccurrence.taskId, input.taskId));

        const view = await findTask(conn, input.taskId);
        return view ? ok(view) : err(notFound());
      });
    },

    async move(input: MoveTaskInput, tx?: TaskCommandDb): Promise<Result<Task>> {
      const invalidSpace = await spaceError(spacePort, input.spaceId);
      if (invalidSpace) return err(invalidSpace);

      const now = clock.now();

      return runInTransaction(db, tx, async (conn) => {
        const current = await findTask(conn, input.taskId);

        if (!current) return err(notFound());
        if (current.spaceId === input.spaceId) return ok(current);

        const [updated] = await conn
          .update(task)
          .set({ spaceId: input.spaceId, version: current.version + 1, updatedAt: now })
          .where(
            and(
              eq(task.id, input.taskId),
              eq(task.version, current.version),
              isNull(task.deletedAt),
            ),
          )
          .returning({ id: task.id });

        if (!updated) {
          const latest = await findTask(conn, input.taskId);
          return err(versionConflict(latest?.version ?? current.version));
        }

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

    /**
     * Deletion con grazia: scrive `deletedAt` e nasconde il task dalle viste.
     * Non elimina righe e non tocca l'occorrenza; il purge arriva con la
     * retention (ADR-0011).
     */
    async delete(input: TaskIdInput, tx?: TaskCommandDb): Promise<Result<Task>> {
      const now = clock.now();

      return runInTransaction(db, tx, async (conn) => {
        const current = await findTaskIncludingDeleted(conn, input.taskId);

        if (!current) return err(notFound());
        if (current.deletedAt) return ok(current);

        // La cancellazione è reversibile, ma resta una scrittura: ADR-0002
        // non prevede eccezioni per uno Space archiviato.
        const invalidSpace = await spaceError(spacePort, current.spaceId);
        if (invalidSpace) return err(invalidSpace);

        const [updated] = await conn
          .update(task)
          .set({ deletedAt: now, version: current.version + 1, updatedAt: now })
          .where(and(eq(task.id, input.taskId), eq(task.version, current.version)))
          .returning({ id: task.id });

        if (!updated) {
          const latest = await findTaskIncludingDeleted(conn, input.taskId);
          return err(versionConflict(latest?.version ?? current.version));
        }

        const view = await findTaskIncludingDeleted(conn, input.taskId);
        return view ? ok(view) : err(notFound());
      });
    },

    /**
     * Ripristino entro la finestra di grazia. Un task attivo è un no-op; uno
     * Space archiviato o cancellato impedisce il rientro, perché il task
     * tornerebbe in una vista che non accetta scritture.
     */
    async restore(input: TaskIdInput, tx?: TaskCommandDb): Promise<Result<Task>> {
      const now = clock.now();

      return runInTransaction(db, tx, async (conn) => {
        const current = await findTaskIncludingDeleted(conn, input.taskId);

        if (!current) return err(notFound());
        if (!current.deletedAt) return ok(current);

        const violation = restoreViolation(current.deletedAt, now);
        if (violation) return err(violation);

        const invalidSpace = await spaceError(spacePort, current.spaceId);
        if (invalidSpace) return err(invalidSpace);

        const [updated] = await conn
          .update(task)
          .set({ deletedAt: null, version: current.version + 1, updatedAt: now })
          .where(and(eq(task.id, input.taskId), eq(task.version, current.version)))
          .returning({ id: task.id });

        if (!updated) {
          const latest = await findTaskIncludingDeleted(conn, input.taskId);
          return err(versionConflict(latest?.version ?? current.version));
        }

        const view = await findTask(conn, input.taskId);
        return view ? ok(view) : err(notFound());
      });
    },
  };
}

export type TaskCommands = ReturnType<typeof createTaskCommands>;
