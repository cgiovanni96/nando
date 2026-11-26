import { UnstyledButton } from "@mantine/core";
import { DayView, MonthView, WeekView } from "@mantine/schedule";
import type { ScheduleEventData, WeekViewProps } from "@mantine/schedule";
import { useCallback, useMemo } from "react";
import type { MouseEvent } from "react";

import {
  allDayRows,
  clipToDay,
  inRange,
  isAllDayRow,
  toWeekEvents,
  viewRange,
} from "@web/lib/calendar/agenda-event";
import type { CalendarEvent, CalendarView } from "@web/lib/calendar/agenda-event";
import type { ScheduleInput } from "@web/lib/calendar/schedule-move";
import type { AgendaItem } from "@web/lib/queries/agenda";
import { CalendarAgenda } from "./calendar-agenda";
import classes from "./calendar-views.module.css";
import { EventBody } from "./event-body";
import { useCalendarDrag } from "./use-calendar-drag";
import { useScheduleLabels } from "./use-schedule-labels";

type CalendarViewsProps = {
  view: CalendarView;
  date: string;
  events: CalendarEvent[];
  onSelect: (item: AgendaItem, rect: DOMRect) => void;
  onOpenDay: (date: string) => void;
  canDrag: boolean;
  canDragItem: (item: AgendaItem) => boolean;
  onReschedule: (item: AgendaItem, schedule: ScheduleInput) => void;
  onPlan: (taskId: string, drop: { dateTime: string; allDay: boolean }) => void;
};

type WeekRenderEventProps = Parameters<NonNullable<WeekViewProps["renderEvent"]>>[1];

// `startScrollTime` scorre solo un'area con un'altezza massima.
const GRID_SCROLL = { mah: "calc(100dvh - 15rem)" };

// La riga sticky copre circa un'ora della griglia: la prima ora visibile è le 07:00.
const START_TIME = "06:00:00";

const DRAG_INTERVAL = 15;

export function CalendarViews({
  view,
  date,
  events,
  onSelect,
  onOpenDay,
  canDrag,
  canDragItem,
  onReschedule,
  onPlan,
}: CalendarViewsProps) {
  const labels = useScheduleLabels();

  // Lo stesso evento può comparire in due segmenti: l'id è la sola chiave stabile.
  const byId = useMemo(() => new Map(events.map((event) => [event.id, event] as const)), [events]);

  const renderEventBody = useCallback(
    (event: ScheduleEventData) => {
      const found = byId.get(String(event.id));

      return found === undefined ? null : <EventBody event={found} />;
    },
    [byId],
  );

  const canDragEvent = useCallback(
    (event: ScheduleEventData) => {
      const found = byId.get(String(event.id));

      return found !== undefined && canDragItem(found.payload.item);
    },
    [byId, canDragItem],
  );

  const canResizeEvent = useCallback(
    (event: ScheduleEventData) => {
      const found = byId.get(String(event.id));

      return (
        found !== undefined && canDragItem(found.payload.item) && found.payload.kind === "range"
      );
    },
    [byId, canDragItem],
  );

  const renderWeekEvent = useCallback(
    (event: ScheduleEventData, props: WeekRenderEventProps) => {
      const { children: _children, ...root } = props;
      const found = byId.get(String(event.id));

      if (found === undefined || !isAllDayRow(found)) {
        return <UnstyledButton {...props} />;
      }

      return (
        <UnstyledButton {...root}>
          <span
            className={classes.allDayBody}
            data-draggable={canDrag && canDragEvent(event) ? "true" : undefined}
          >
            <EventBody event={found} />
          </span>
        </UnstyledButton>
      );
    },
    [byId, canDrag, canDragEvent],
  );

  const onEventClick = useCallback(
    (event: ScheduleEventData, e: MouseEvent<HTMLButtonElement>) => {
      const found = byId.get(String(event.id));

      if (found === undefined) {
        return;
      }

      onSelect(found.payload.item, e.currentTarget.getBoundingClientRect());
    },
    [byId, onSelect],
  );

  const getDayProps = useCallback((day: string) => ({ "data-day": day }), []);

  const weekEvents = useMemo(() => toWeekEvents(events), [events]);
  const weekRange = useMemo(() => viewRange("week", date), [date]);
  const allDayRowsCount = useMemo(
    () => Math.max(2, allDayRows(events, weekRange.from, weekRange.to)),
    [events, weekRange],
  );

  const dayEvents = useMemo(() => clipToDay(events, date), [events, date]);
  const agendaRange = useMemo(() => viewRange("agenda", date), [date]);
  const agendaEvents = useMemo(
    () => inRange(events, agendaRange.from, agendaRange.to),
    [events, agendaRange],
  );

  const {
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
  } = useCalendarDrag({
    view,
    events,
    weekEvents,
    dayEvents,
    weekFrom: weekRange.from,
    onReschedule,
    onPlan,
  });

  if (view === "agenda") {
    return (
      <CalendarAgenda
        from={agendaRange.from}
        to={agendaRange.to}
        events={agendaEvents}
        labels={labels}
        onEventClick={onEventClick}
      />
    );
  }

  const month = (
    <MonthView
      date={date}
      events={events}
      labels={labels}
      renderEventBody={renderEventBody}
      onEventClick={onEventClick}
      onDayClick={onOpenDay}
      getDayProps={getDayProps}
      withEventsDragAndDrop={canDrag}
      canDragEvent={canDragEvent}
      onEventDrop={onMonthDrop}
      withHeader={false}
      maxEventsPerDay={3}
      weekdayFormat="ddd"
    />
  );

  const week = (
    <WeekView
      date={date}
      events={weekEvents}
      labels={labels}
      renderEventBody={renderEventBody}
      renderEvent={renderWeekEvent}
      onEventClick={onEventClick}
      withHeader={false}
      highlightToday
      withWeekNumber={false}
      intervalMinutes={60}
      startScrollTime={START_TIME}
      allDaySlotHeight={24 * allDayRowsCount}
      classNames={{
        weekViewAllDaySlots: classes.weekAllDay,
        weekViewAllDaySlotsEvents: classes.allDayEvents,
      }}
      scrollAreaProps={GRID_SCROLL}
      weekdayFormat="ddd"
      withEventsDragAndDrop={canDrag}
      withEventResize={canDrag}
      canDragEvent={canDragEvent}
      canResizeEvent={canResizeEvent}
      onEventDrop={onWeekDrop}
      onEventResize={onWeekResize}
      eventDragInterval={DRAG_INTERVAL}
      eventResizeInterval={DRAG_INTERVAL}
      {...(canDrag ? { onExternalEventDrop: onExternalDrop, canDropExternalEvent } : {})}
    />
  );

  const day = (
    <DayView
      date={date}
      events={dayEvents}
      labels={labels}
      renderEventBody={renderEventBody}
      onEventClick={onEventClick}
      withHeader={false}
      intervalMinutes={60}
      startScrollTime={START_TIME}
      scrollAreaProps={GRID_SCROLL}
      classNames={{
        dayViewAllDay: classes.dayAllDay,
        dayViewSlotLabel: classes.daySlotLabel,
      }}
      withEventsDragAndDrop={canDrag}
      withEventResize={canDrag}
      canDragEvent={canDragEvent}
      canResizeEvent={canResizeEvent}
      onEventDrop={onDayDrop}
      onEventResize={onDayResize}
      eventDragInterval={DRAG_INTERVAL}
      eventResizeInterval={DRAG_INTERVAL}
    />
  );

  return (
    <div
      data-dragging={dragging ? "true" : undefined}
      onDragStartCapture={onDragStartCapture}
      onDropCapture={onDropCapture}
    >
      {view === "month" ? month : view === "week" ? week : day}
    </div>
  );
}
