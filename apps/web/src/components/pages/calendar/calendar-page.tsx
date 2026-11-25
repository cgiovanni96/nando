import { ClientOnly } from "@tanstack/react-router";

import { CalendarBoard } from "./calendar-board";
import { CalendarSkeleton } from "./calendar-skeleton";

export function CalendarPage() {
  return (
    // Il server può stare in un altro fuso e non conosce il viewport: il calendario nasce nel browser.
    <ClientOnly fallback={<CalendarSkeleton />}>
      <CalendarBoard />
    </ClientOnly>
  );
}
