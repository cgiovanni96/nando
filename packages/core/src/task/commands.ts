import { and, desc, eq, isNull } from "drizzle-orm";
import type { Clock, DomainError, Result } from "@nando/kernel";
import { err, ok } from "@nando/kernel";

import {
  normalizeTaskTitle,
  restoreViolation,
  spaceViolation,
  TASK_STATUS_TARGETS,
  titleViolation,
  transitionViolation,
  type Task,
  type TaskStatus,
} from "./domain";
import { findTask, findTaskIncludingDeleted, scheduleColumns } from "./mapper";
import type { TaskCommandDb, TaskDatabase, TaskSpacePort } from "./ports";
import { buildSchedule, type Schedule, type ScheduleInput } from "./schedule";
import { task, taskCompletion, taskOccurrence, taskRectification } from "./schema";

export type TaskCommandDeps = {
  db: TaskDatabase;
  clock: Clock;
  ids: () => string;
  spacePort: TaskSpacePort;
  /** Timezone IANA dei nuovi task: `OWNER_TIME_ZONE` (ADR-0004). */
  defaultTimeZone: string;
};

export type CreateTaskInput = {
  title: string;
  spaceId: string | null;
  schedule: ScheduleInput | null;
};

export type UpdateTaskInput = {
  taskId: string;
  expectedVersion: number;
  title: string;
  spaceId: string | null;
  schedule: ScheduleInput | null;
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

/** Titolo e Schedule validi, nella timezone del Task. */
function validateContent(
  input: { title: string; schedule: ScheduleInput | null },
  timeZone: string,
): Result<Schedule | null> {
  const invalidTitle = titleViolation(input.title);
  if (invalidTitle) return err(invalidTitle);
  return input.schedule ? buildSchedule(input.schedule, timeZone) : ok(null);
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

export function createTaskCommands({
  db,
  clock,
  ids,
  spacePort,
  defaultTimeZone,
}: TaskCommandDeps) {
  /**
   * Cambio di stato dell'unica occorrenza. `effect` aggiunge le scritture del
   * comando (Completion, rettifica, data di chiusura) dentro la stessa
   * transazione e restituisce i campi extra dell'occorrenza.
   */
  async function transition(
    taskId: string,
    target: TaskStatus,
    tx?: TaskCommandDb,
    options: {
      violation?: (from: TaskStatus) => DomainError | null;
      effect?: (
        conn: TaskCommandDb,
        occurrence: { id: string; activityId: string | null },
        now: Date,
      ) => Promise<Result<Partial<typeof taskOccurrence.$inferInsert>>>;
    } = {},
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

      const violation = (options.violation ?? ((from) => transitionViolation(from, target)))(
        current.status,
      );
      if (violation) return err(violation);

      const [occurrence] = await conn
        .select({ id: taskOccurrence.id, activityId: taskOccurrence.activityId })
        .from(taskOccurrence)
        .where(eq(taskOccurrence.taskId, taskId))
        .limit(1);

      if (!occurrence) return err(notFound());

      const extra = options.effect ? await options.effect(conn, occurrence, now) : ok({});
      if (!extra.ok) return extra;

      const [updated] = await conn
        .update(taskOccurrence)
        .set({ ...extra.value, status: target, updatedAt: now })
        .where(eq(taskOccurrence.id, occurrence.id))
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
      const content = validateContent(input, defaultTimeZone);
      if (!content.ok) return content;

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
            timeZone: defaultTimeZone,
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
          ...scheduleColumns(content.value),
          createdAt: now,
          updatedAt: now,
        });

        const view = await findTask(conn, taskId);
        return view ? ok(view) : err(internalError());
      });
    },

    async update(input: UpdateTaskInput, tx?: TaskCommandDb): Promise<Result<Task>> {
      const invalidTitle = titleViolation(input.title);
      if (invalidTitle) return err(invalidTitle);

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

        // Lo Schedule si valuta nella timezone del Task, letta qui; il titolo
        // è già stato validato prima della transazione.
        const content = input.schedule ? buildSchedule(input.schedule, current.timeZone) : ok(null);
        if (!content.ok) return content;

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
          .set({ ...scheduleColumns(content.value), updatedAt: now })
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

    /** open → in_progress: solo stato di lavoro, nessun Completion (ADR-0028). */
    async start(input: TaskIdInput, tx?: TaskCommandDb): Promise<Result<Task>> {
      return transition(input.taskId, TASK_STATUS_TARGETS.start, tx);
    },

    /** in_progress → open, «rimetti da fare»: nessun Completion né rettifica. */
    async markTodo(input: TaskIdInput, tx?: TaskCommandDb): Promise<Result<Task>> {
      return transition(input.taskId, TASK_STATUS_TARGETS.markTodo, tx);
    },

    /**
     * Completa l'occorrenza con un Completion datato adesso (ADR-0004).
     * L'`activityId` nasce al primo completamento e si riusa dopo una
     * rettifica, così la stessa azione non conta due volte (ADR-0003).
     */
    async complete(input: TaskIdInput, tx?: TaskCommandDb): Promise<Result<Task>> {
      return transition(input.taskId, TASK_STATUS_TARGETS.complete, tx, {
        effect: async (conn, occurrence, now) => {
          const activityId = occurrence.activityId ?? ids();
          await conn.insert(taskCompletion).values({
            id: ids(),
            occurrenceId: occurrence.id,
            activityId,
            occurredAt: now,
            provenance: "manual",
            createdAt: now,
          });
          return ok({ activityId, closedAt: null });
        },
      });
    },

    async skip(input: TaskIdInput, tx?: TaskCommandDb): Promise<Result<Task>> {
      return transition(input.taskId, TASK_STATUS_TARGETS.skip, tx, {
        effect: async (_conn, _occurrence, now) => ok({ closedAt: now }),
      });
    },

    async cancel(input: TaskIdInput, tx?: TaskCommandDb): Promise<Result<Task>> {
      return transition(input.taskId, TASK_STATUS_TARGETS.cancel, tx, {
        effect: async (_conn, _occurrence, now) => ok({ closedAt: now }),
      });
    },

    /**
     * Riapertura di un completamento: una Rectification annulla l'ultimo
     * Completion e l'occorrenza torna a `open` (o `in_progress`, se richiesto).
     * Il Completion resta interrogabile. Riaprire verso lo stato già corrente è
     * un no-op; da `skipped` o `cancelled` non si riapre.
     */
    async reopen(
      input: TaskIdInput & { to?: "open" | "in_progress" },
      tx?: TaskCommandDb,
    ): Promise<Result<Task>> {
      const target = input.to ?? "open";

      return transition(input.taskId, target, tx, {
        violation: (from) =>
          from === "completed"
            ? null
            : { code: "domain_rule_violation", message: "Si riapre solo un task completato." },
        effect: async (conn, occurrence, now) => {
          const [active] = await conn
            .select({ id: taskCompletion.id })
            .from(taskCompletion)
            .leftJoin(taskRectification, eq(taskRectification.completionId, taskCompletion.id))
            .where(
              and(eq(taskCompletion.occurrenceId, occurrence.id), isNull(taskRectification.id)),
            )
            .orderBy(desc(taskCompletion.occurredAt))
            .limit(1);

          // Dopo il backfill della 0007 ogni occorrenza completata ha un
          // Completion attivo; se mancasse, si riapre comunque senza rettifica.
          if (active) {
            await conn.insert(taskRectification).values({
              id: ids(),
              completionId: active.id,
              action: "revert",
              reason: null,
              provenance: "manual",
              createdAt: now,
            });
          }
          return ok({ closedAt: null });
        },
      });
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
