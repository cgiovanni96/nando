import { UnstyledButton } from "@mantine/core";
import { AgendaView } from "@mantine/schedule";
import type { AgendaViewProps, ScheduleEventData, ScheduleLabelsOverride } from "@mantine/schedule";
import { useCallback, useMemo } from "react";
import type { MouseEvent } from "react";

import type { CalendarEvent } from "@web/lib/calendar/agenda-event";
import classes from "./calendar-agenda.module.css";
import { EventBody } from "./event-body";

type AgendaRenderEventProps = Parameters<NonNullable<AgendaViewProps["renderEvent"]>>[1];

type CalendarAgendaProps = {
  from: string;
  to: string;
  events: CalendarEvent[];
  labels: ScheduleLabelsOverride;
  onEventClick: (event: ScheduleEventData, e: MouseEvent<HTMLButtonElement>) => void;
};

export function CalendarAgenda({ from, to, events, labels, onEventClick }: CalendarAgendaProps) {
  const byId = useMemo(() => new Map(events.map((event) => [event.id, event] as const)), [events]);

  const renderEvent = useCallback(
    (event: ScheduleEventData, props: AgendaRenderEventProps) => {
      const { children, ...root } = props;
      const found = byId.get(String(event.id));

      return (
        <UnstyledButton {...root}>
          {found === undefined ? children : <EventBody event={found} />}
        </UnstyledButton>
      );
    },
    [byId],
  );

  return (
    <AgendaView
      rangeStart={from}
      rangeEnd={to}
      events={events}
      labels={labels}
      onEventClick={onEventClick}
      renderEvent={renderEvent}
      dateHeaderFormat="dddd D MMMM"
      classNames={{
        agendaViewHeader: classes.agendaHeader,
        agendaViewDateHeader: classes.agendaDateHeader,
        agendaViewEvent: classes.agendaEvent,
      }}
    />
  );
}
