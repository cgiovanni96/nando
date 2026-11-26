import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, lt, lte, or, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { Clock } from "@nando/kernel";

import { clampLimit, decodeIdCursor, encodeCursor } from "../db/cursor";
import type { InboxCursor, InboxItem } from "../space/domain";
import type { InboxSourceQuery } from "../space/ports";
import type { AgendaEntry, Task, TaskHistoryEntry, TaskStatus } from "./domain";
import { findTaskIncludingDeleted, taskViewColumns, toTask } from "./mapper";
import type { TaskDatabase } from "./ports";
import { scheduleDueDate, scheduleStartDate, temporalState } from "./schedule";
import type { LocalDate } from "./schedule";
import { task, taskCompletion, taskOccurrence, taskRectification } from "./schema";

export type TaskQueryDeps = {
  db: TaskDatabase;
  clock: Clock;
};

export type TaskListState = "active" | "deleted";

export type ListTasksFilter = {
  /** `null` filtra l'Inbox; `undefined` non filtra. */
  spaceId?: string | null;
  status?: TaskStatus;
  /** `true` tiene solo i task con uno Schedule, `false` solo quelli senza; `undefined` non filtra. */
  scheduled?: boolean;
  /** `active` esclude i cancellati, `deleted` mostra solo quelli in grazia. */
  state?: TaskListState;
  cursor?: string | null;
  limit?: number;
};

/** Intervallo di giorni locali dell'agenda, estremi inclusi. */
export type AgendaFilter = {
  from: LocalDate;
  to: LocalDate;
  /** Restituisce anche le occorrenze già scadute ora, qualunque sia la data. */
  includeOverdue?: boolean;
  /** Restituisce anche le occorrenze chiuse (`completed`, `skipped`, `cancelled`). */
  includeClosed?: boolean;
  cursor?: string | null;
  limit?: number;
};

/** Tipo che questa sorgente dichiara nell'Inbox: uno solo, i task. */
const INBOX_ENTITY_TYPE = "task";

/** Occorrenze attive, `open` e `in_progress`: le uniche che l'agenda mostra di default. */
const ACTIVE_STATUSES = ["open", "in_progress"] as const;

/** Occorrenze chiuse: tornano solo con `includeClosed`. */
const CLOSED_STATUSES = ["completed", "skipped", "cancelled"] as const;

export function createTaskQueries({ db, clock }: TaskQueryDeps) {
  return {
    /**
     * Lettura per id: dentro la finestra di grazia il task resta interrogabile,
     * con `deletedAt` valorizzato. Le viste usano invece `list`, che lo esclude.
     */
    async get(taskId: string): Promise<Task | null> {
      return findTaskIncludingDeleted(db, taskId);
    },

    /**
     * Storico dell'occorrenza, dal più recente: completamenti, riaperture
     * (rettifiche) e chiusura per skip o cancel. Niente si cancella: una
     * riapertura si aggiunge accanto al completamento che annulla.
     * `null` se il task non esiste.
     */
    async history(taskId: string): Promise<TaskHistoryEntry[] | null> {
      const [occurrence] = await db
        .select({
          id: taskOccurrence.id,
          status: taskOccurrence.status,
          closedAt: taskOccurrence.closedAt,
        })
        .from(taskOccurrence)
        .where(eq(taskOccurrence.taskId, taskId))
        .limit(1);

      if (!occurrence) return null;

      const rows = await db
        .select({
          completionId: taskCompletion.id,
          occurredAt: taskCompletion.occurredAt,
          rectifiedAt: taskRectification.createdAt,
        })
        .from(taskCompletion)
        .leftJoin(taskRectification, eq(taskRectification.completionId, taskCompletion.id))
        .where(eq(taskCompletion.occurrenceId, occurrence.id));

      const entries: TaskHistoryEntry[] = rows.flatMap((row) => {
        const completed: TaskHistoryEntry = { kind: "completed", at: row.occurredAt };
        return row.rectifiedAt
          ? [completed, { kind: "reopened", at: row.rectifiedAt }]
          : [completed];
      });

      if (
        (occurrence.status === "skipped" || occurrence.status === "cancelled") &&
        occurrence.closedAt
      ) {
        entries.push({ kind: occurrence.status, at: occurrence.closedAt });
      }

      return entries.sort((a, b) => b.at.getTime() - a.at.getTime());
    },

    async list(
      filter: ListTasksFilter = {},
    ): Promise<{ items: Task[]; nextCursor: string | null }> {
      const limit = clampLimit(filter.limit);
      const conditions: SQL[] = [
        filter.state === "deleted" ? isNotNull(task.deletedAt) : isNull(task.deletedAt),
      ];

      if (filter.spaceId === null) {
        conditions.push(isNull(task.spaceId));
      } else if (filter.spaceId) {
        conditions.push(eq(task.spaceId, filter.spaceId));
      }

      if (filter.status) {
        conditions.push(eq(taskOccurrence.status, filter.status));
      }

      if (filter.scheduled === true) {
        conditions.push(
          sql`(${taskOccurrence.endDate} is not null or ${taskOccurrence.endAt} is not null)`,
        );
      } else if (filter.scheduled === false) {
        conditions.push(
          sql`(${taskOccurrence.endDate} is null and ${taskOccurrence.endAt} is null)`,
        );
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
        items: items.map(toTask),
        nextCursor: hasMore && last ? encodeCursor({ id: last.id }) : null,
      };
    },

    /**
     * Agenda: le occorrenze con uno Schedule che toccano l'intervallo di giorni
     * locali, più quelle scadute ora se richiesto. Di default solo le occorrenze
     * attive; con `includeClosed` anche le chiuse. L'estensione per scadenza
     * vale solo per le occorrenze attive. Ogni giorno si valuta nella timezone
     * del Task; l'ordine è per id, come `list`.
     */
    async agenda(
      filter: AgendaFilter,
    ): Promise<{ items: AgendaEntry[]; nextCursor: string | null }> {
      const now = clock.now();
      const nowIso = now.toISOString();
      const limit = clampLimit(filter.limit);

      // Giorni locali dell'occorrenza: per un all-day sono già date locali, per
      // un timed si converte l'istante nella timezone del Task.
      const localDue = sql`case when ${taskOccurrence.allDay} then ${taskOccurrence.endDate} else (${taskOccurrence.endAt} at time zone ${task.timeZone})::date end`;
      const localStart = sql`case when ${taskOccurrence.allDay} then coalesce(${taskOccurrence.startDate}, ${taskOccurrence.endDate}) else (coalesce(${taskOccurrence.startAt}, ${taskOccurrence.endAt}) at time zone ${task.timeZone})::date end`;
      const inRange = sql`${localStart} <= ${filter.to}::date and ${localDue} >= ${filter.from}::date`;
      const overdue = sql`((${taskOccurrence.allDay} and ${taskOccurrence.endDate} < (${nowIso}::timestamptz at time zone ${task.timeZone})::date) or (not ${taskOccurrence.allDay} and ${taskOccurrence.endAt} < ${nowIso}::timestamptz))`;
      const statuses = filter.includeClosed
        ? [...ACTIVE_STATUSES, ...CLOSED_STATUSES]
        : [...ACTIVE_STATUSES];
      // L'estensione per scadenza copre le sole occorrenze attive: una chiusa
      // fuori dall'intervallo non torna mai, nemmeno con entrambi i flag.
      const range = filter.includeOverdue
        ? or(inRange, and(inArray(taskOccurrence.status, [...ACTIVE_STATUSES]), overdue))
        : inRange;

      const conditions: (SQL | undefined)[] = [
        isNull(task.deletedAt),
        inArray(taskOccurrence.status, statuses),
        sql`(${taskOccurrence.endDate} is not null or ${taskOccurrence.endAt} is not null)`,
        range,
      ];

      if (filter.cursor) {
        const cursorId = decodeIdCursor(filter.cursor);

        if (cursorId) {
          conditions.push(gt(task.id, cursorId));
        }
      }

      const rows = await db
        .select(taskViewColumns)
        .from(task)
        .innerJoin(taskOccurrence, eq(taskOccurrence.taskId, task.id))
        .where(and(...conditions))
        .orderBy(asc(task.id))
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const page = hasMore ? rows.slice(0, limit) : rows;
      const last = page.at(-1);
      const items = page
        .map((row) => toAgendaEntry(toTask(row), now))
        .filter((entry): entry is AgendaEntry => entry !== null);

      return {
        items,
        nextCursor: hasMore && last ? encodeCursor({ id: last.id }) : null,
      };
    },

    /**
     * Sorgente dell'Inbox: i task senza Space, non cancellati, nello stesso
     * ordine del merge (`updatedAt` discendente, tipo e id ascendenti) così il
     * cursore composto riprende esattamente dopo l'ultimo elemento letto.
     */
    async listUnassigned({ cursor, limit }: InboxSourceQuery): Promise<readonly InboxItem[]> {
      const conditions: SQL[] = [isNull(task.deletedAt), isNull(task.spaceId)];

      const cursorCondition = inboxCursorCondition(cursor);
      if (cursorCondition) conditions.push(cursorCondition);

      const rows = await db
        .select({ id: task.id, title: task.title, updatedAt: task.updatedAt })
        .from(task)
        .where(and(...conditions))
        .orderBy(desc(task.updatedAt), asc(task.id))
        .limit(limit);

      return rows.map((row) => ({
        entityType: INBOX_ENTITY_TYPE,
        id: row.id,
        title: row.title,
        updatedAt: row.updatedAt,
      }));
    },
  };
}

/** Voce d'agenda dalla vista piatta; `null` senza Schedule. */
function toAgendaEntry(view: Task, now: Date): AgendaEntry | null {
  const schedule = view.schedule;
  if (!schedule) return null;

  return {
    ...view,
    schedule,
    temporalState: temporalState(schedule, view.status, now),
    dueDate: scheduleDueDate(schedule),
    startDate: scheduleStartDate(schedule),
  };
}

/**
 * Ripresa dopo il cursore composto dell'Inbox.
 *
 * Il tipo della sorgente è noto, quindi il confronto si decide qui: se il
 * cursore ha un tipo minore, tutti i task con lo stesso `updatedAt` vengono
 * dopo; se è maggiore, nessuno; se è uguale, si riprende per id.
 */
function inboxCursorCondition(cursor: InboxCursor | null): SQL | undefined {
  if (!cursor) return undefined;

  const updatedAt = new Date(cursor.updatedAt);

  if (cursor.entityType > INBOX_ENTITY_TYPE) {
    return lt(task.updatedAt, updatedAt);
  }

  if (cursor.entityType < INBOX_ENTITY_TYPE) {
    return lte(task.updatedAt, updatedAt);
  }

  return or(
    lt(task.updatedAt, updatedAt),
    and(eq(task.updatedAt, updatedAt), gt(task.id, cursor.id)),
  );
}

export type TaskQueries = ReturnType<typeof createTaskQueries>;
