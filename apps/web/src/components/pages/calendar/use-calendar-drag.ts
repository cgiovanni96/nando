import type { ScheduleCanDropExternalEventData, WeekViewProps } from "@mantine/schedule";
import { useCallback, useRef } from "react";
import type { DragEvent } from "react";

import { isAllDayRow } from "@web/lib/calendar/agenda-event";
import type { CalendarEvent, CalendarView } from "@web/lib/calendar/agenda-event";
import { columnDay } from "@web/lib/calendar/grabbed-day";
import { moveSchedule, resizeSchedule } from "@web/lib/calendar/schedule-move";
import type { ScheduleInput } from "@web/lib/calendar/schedule-move";
import { UNSCHEDULED_TASK_TYPE } from "@web/lib/calendar/unscheduled-drag";
import type { AgendaItem } from "@web/lib/queries/agenda";
import classes from "./calendar-views.module.css";
import { useDragInProgress } from "./use-drag-in-progress";

type EventDropData = Parameters<NonNullable<WeekViewProps["onEventDrop"]>>[0];
type EventResizeData = Parameters<NonNullable<WeekViewProps["onEventResize"]>>[0];

type UseCalendarDragOptions = {
  view: CalendarView;
  events: CalendarEvent[];
  weekEvents: CalendarEvent[];
  dayEvents: CalendarEvent[];
  weekFrom: string;
  onReschedule: (item: AgendaItem, schedule: ScheduleInput) => void;
  onPlan: (taskId: string, drop: { dateTime: string; allDay: boolean }) => void;
};

export function useCalendarDrag({
  view,
  events,
  weekEvents,
  dayEvents,
  weekFrom,
  onReschedule,
  onPlan,
}: UseCalendarDragOptions) {
  const dragging = useDragInProgress();
  const grabbedDay = useRef<string | null>(null);
  const droppedOnAllDay = useRef(false);

  const applyDrop = useCallback(
    (source: CalendarEvent[], data: EventDropData) => {
      const shown = source.find((event) => event.id === String(data.eventId));

      if (shown === undefined) {
        return;
      }

      const schedule = moveSchedule(shown.payload.item.schedule, {
        shownStart: shown.start,
        newStart: data.newStart,
        grabbedDay: grabbedDay.current,
      });

      if (schedule !== null) {
        onReschedule(shown.payload.item, schedule);
      }
    },
    [onReschedule],
  );

  const applyResize = useCallback(
    (source: CalendarEvent[], data: EventResizeData) => {
      const shown = source.find((event) => event.id === String(data.eventId));

      if (shown === undefined) {
        return;
      }

      const schedule = resizeSchedule(shown.payload.item.schedule, {
        shownStart: shown.start,
        shownEnd: shown.end,
        newStart: data.newStart,
        newEnd: data.newEnd,
      });

      if (schedule !== null) {
        onReschedule(shown.payload.item, schedule);
      }
    },
    [onReschedule],
  );

  const onMonthDrop = useCallback(
    (data: EventDropData) => applyDrop(events, data),
    [applyDrop, events],
  );
  const onWeekDrop = useCallback(
    (data: EventDropData) => applyDrop(weekEvents, data),
    [applyDrop, weekEvents],
  );
  const onDayDrop = useCallback(
    (data: EventDropData) => applyDrop(dayEvents, data),
    [applyDrop, dayEvents],
  );
  const onWeekResize = useCallback(
    (data: EventResizeData) => applyResize(weekEvents, data),
    [applyResize, weekEvents],
  );
  const onDayResize = useCallback(
    (data: EventResizeData) => applyResize(dayEvents, data),
    [applyResize, dayEvents],
  );

  const onExternalDrop = useCallback(
    (dataTransfer: DataTransfer, dateTime: string) => {
      const taskId = dataTransfer.getData(UNSCHEDULED_TASK_TYPE);

      if (taskId === "") {
        return;
      }

      onPlan(taskId, { dateTime, allDay: droppedOnAllDay.current });
    },
    [onPlan],
  );

  // Durante il drag si leggono solo i tipi, mai il contenuto.
  const canDropExternalEvent = useCallback(
    (data: ScheduleCanDropExternalEventData) =>
      data.dataTransfer.types.includes(UNSCHEDULED_TASK_TYPE),
    [],
  );

  const onDropCapture = useCallback((event: DragEvent<HTMLDivElement>) => {
    const target = event.target;

    droppedOnAllDay.current =
      target instanceof Element && target.closest(`.${classes.weekAllDay}`) !== null;
  }, []);

  const onDragStartCapture = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      const target = event.target;
      const root = target instanceof Element ? target.closest("[data-event-id]") : null;

      if (root === null) {
        grabbedDay.current = null;
        return;
      }

      if (view === "month") {
        const cell = document
          .elementsFromPoint(event.clientX, event.clientY)
          .find((element) => element.hasAttribute("data-day"));

        grabbedDay.current = cell?.getAttribute("data-day") ?? null;
        return;
      }

      // Solo la testata della settimana ha colonne: nella griglia e nel giorno l'inizio basta.
      const shown =
        view === "week"
          ? weekEvents.find((candidate) => candidate.id === root.getAttribute("data-event-id"))
          : undefined;
      const parent = root.parentElement;

      if (shown === undefined || parent === null || !isAllDayRow(shown)) {
        grabbedDay.current = null;
        return;
      }

      const rect = parent.getBoundingClientRect();
      grabbedDay.current = columnDay({
        pointer: event.clientX,
        left: rect.left,
        width: rect.width,
        from: weekFrom,
      });
    },
    [view, weekEvents, weekFrom],
  );

  return {
    dragging,
    onDragStartCapture,
    onDropCapture,
    onMonthDrop,
    onWeekDrop,
    onDayDrop,
    onWeekResize,
    onDayResize,
    onExternalDrop,
    canDropExternalEvent,
  };
}
