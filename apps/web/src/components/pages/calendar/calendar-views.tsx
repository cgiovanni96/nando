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
import type { AgendaItem } from "@web/lib/queries/agenda";
import { CalendarAgenda } from "./calendar-agenda";
import classes from "./calendar-views.module.css";
import { EventBody } from "./event-body";
import { useScheduleLabels } from "./use-schedule-labels";

type CalendarViewsProps = {
  view: CalendarView;
  date: string;
  events: CalendarEvent[];
  onSelect: (item: AgendaItem, rect: DOMRect) => void;
  onOpenDay: (date: string) => void;
};

type WeekRenderEventProps = Parameters<NonNullable<WeekViewProps["renderEvent"]>>[1];

// `startScrollTime` scorre solo un'area con un'altezza massima.
const GRID_SCROLL = { mah: "calc(100dvh - 15rem)" };

// La riga sticky copre circa un'ora della griglia: la prima ora visibile è le 07:00.
const START_TIME = "06:00:00";

export function CalendarViews({ view, date, events, onSelect, onOpenDay }: CalendarViewsProps) {
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

  const renderWeekEvent = useCallback(
    (event: ScheduleEventData, props: WeekRenderEventProps) => {
      const { children: _children, ...root } = props;
      const found = byId.get(String(event.id));

      if (found === undefined || !isAllDayRow(found)) {
        return <UnstyledButton {...props} />;
      }

      return (
        <UnstyledButton {...root}>
          <span className={classes.allDayBody}>
            <EventBody event={found} />
          </span>
        </UnstyledButton>
      );
    },
    [byId],
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

  if (view === "month") {
    return (
      <MonthView
        date={date}
        events={events}
        labels={labels}
        renderEventBody={renderEventBody}
        onEventClick={onEventClick}
        onDayClick={onOpenDay}
        withHeader={false}
        maxEventsPerDay={3}
        weekdayFormat="ddd"
      />
    );
  }

  if (view === "week") {
    return (
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
      />
    );
  }

  if (view === "day") {
    return (
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
      />
    );
  }

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
