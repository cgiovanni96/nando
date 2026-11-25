import { useTranslation } from "react-i18next";

import type { CalendarEvent } from "@web/lib/calendar/agenda-event";
import { formatScheduleTime } from "@web/lib/format/schedule";
import type { AgendaItem } from "@web/lib/queries/agenda";
import classes from "./event-body.module.css";

const CLOSED_STATUSES: ReadonlySet<AgendaItem["status"]> = new Set<AgendaItem["status"]>([
  "completed",
  "skipped",
  "cancelled",
]);

/** «Aperto» non si scrive: lo dice l'assenza di stato. In ritardo vince sullo stato. */
function statusKey(item: AgendaItem) {
  if (item.temporalState === "overdue") {
    return "task.status.late" as const;
  }
  if (item.status === "open") {
    return null;
  }
  return `task.status.${item.status}` as const;
}

export function EventBody({ event }: { event: CalendarEvent }) {
  const { t } = useTranslation();
  const { item, kind } = event.payload;
  const time = formatScheduleTime(item);
  const key = statusKey(item);
  const closed = CLOSED_STATUSES.has(item.status);

  return (
    <span className={classes.body} data-kind={kind} data-closed={closed ? "true" : undefined}>
      {time === null ? null : <span className={classes.time}>{time}</span>}
      <span
        className={
          item.status === "completed" ? `${classes.title} ${classes.struck}` : classes.title
        }
      >
        {event.title}
      </span>
      {key === null ? null : <span className={classes.muted}>{t(key)}</span>}
    </span>
  );
}
