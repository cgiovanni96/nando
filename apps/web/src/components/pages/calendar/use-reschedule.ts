import { notifications } from "@mantine/notifications";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { ApiError } from "@web/lib/api-error";
import { placeInCalendar, withSchedule } from "@web/lib/calendar/reschedule-cache";
import type { ScheduleInput } from "@web/lib/calendar/schedule-move";
import { newCommandId } from "@web/lib/ids";
import { updateTask } from "@web/lib/mutations/tasks";
import type { AgendaItem } from "@web/lib/queries/agenda";
import type { TaskItem } from "@web/lib/queries/tasks";

const CALENDAR_KEY = ["tasks", "agenda", "calendar"] as const;
const UNSCHEDULED_KEY = ["tasks", "unscheduled"] as const;

type RescheduleVariables = {
  task: TaskItem | AgendaItem;
  schedule: ScheduleInput;
  commandId: string;
};

export type Reschedule = {
  reschedule: (task: TaskItem | AgendaItem, schedule: ScheduleInput) => void;
  isPending: (taskId: string) => boolean;
};

export function useReschedule(): Reschedule {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<ReadonlySet<string>>(() => new Set<string>());
  const pendingIds = useRef(new Set<string>());

  const endPending = useCallback((taskId: string) => {
    pendingIds.current.delete(taskId);
    setPending((current) => {
      if (!current.has(taskId)) return current;

      const next = new Set(current);
      next.delete(taskId);
      return next;
    });
  }, []);

  const { mutate } = useMutation({
    mutationFn: ({ task, schedule, commandId }: RescheduleVariables) =>
      updateTask({
        taskId: task.id,
        input: {
          commandId,
          expectedVersion: task.version,
          title: task.title,
          spaceId: task.spaceId,
          schedule,
        },
      }),

    onMutate: async ({ task, schedule }: RescheduleVariables) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: CALENDAR_KEY }),
        queryClient.cancelQueries({ queryKey: UNSCHEDULED_KEY }),
      ]);

      const calendars = queryClient.getQueriesData<AgendaItem[]>({ queryKey: CALENDAR_KEY });
      const unscheduled = queryClient.getQueryData<TaskItem[]>(UNSCHEDULED_KEY);
      const moved = withSchedule(task, schedule);

      // La chiave del calendario finisce con l'intervallo: `from` e `to`.
      for (const [key, items] of calendars) {
        const from = key[3];
        const to = key[4];

        if (!items || typeof from !== "string" || typeof to !== "string") continue;

        queryClient.setQueryData(key, placeInCalendar(items, moved, { from, to }));
      }

      if (unscheduled !== undefined) {
        queryClient.setQueryData<TaskItem[]>(
          UNSCHEDULED_KEY,
          unscheduled.filter((item) => item.id !== task.id),
        );
      }

      return { calendars, unscheduled };
    },

    onError: (error, _variables, context) => {
      if (context) {
        for (const [key, items] of context.calendars) {
          queryClient.setQueryData(key, items);
        }

        queryClient.setQueryData(UNSCHEDULED_KEY, context.unscheduled);
      }

      notifications.show({
        message:
          error instanceof ApiError
            ? error.code === "version_conflict"
              ? t("calendar.move.conflict")
              : error.message
            : t("calendar.move.error"),
        color: "red",
        withCloseButton: false,
        p: "sm",
        radius: "sm",
      });
    },

    onSettled: (_data, _error, { task }) => {
      const refreshed = queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["inbox"] });

      // Il task resta non trascinabile finché il refetch non ha riportato la verità.
      return refreshed.finally(() => endPending(task.id));
    },
  });

  const reschedule = useCallback(
    (task: TaskItem | AgendaItem, schedule: ScheduleInput) => {
      if (pendingIds.current.has(task.id)) return;

      pendingIds.current.add(task.id);
      setPending((current) => new Set(current).add(task.id));
      // Un id per drop: un retry dello stesso invio non duplica il comando.
      mutate({ task, schedule, commandId: newCommandId() });
    },
    [mutate],
  );

  const isPending = useCallback((taskId: string) => pending.has(taskId), [pending]);

  return { reschedule, isPending };
}
