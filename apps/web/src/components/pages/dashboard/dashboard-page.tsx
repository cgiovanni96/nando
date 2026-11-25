import { Skeleton, Stack, Title } from "@mantine/core";
import { ClientOnly } from "@tanstack/react-router";

import { formatLocalDate } from "@web/lib/format/datetime";
import { localToday } from "@web/lib/local-date";
import { TodayWidget } from "./today-widget";

/** Altezza di un h1 nel tema (28px × 1.3): il titolo non sposta il layout quando arriva. */
const TITLE_HEIGHT = 36.4;

export function DashboardPage() {
  return (
    <Stack gap="xl">
      {/* «Oggi» è il giorno del browser: il server può essere in un altro fuso. */}
      <ClientOnly fallback={<Skeleton height={TITLE_HEIGHT} width={280} />}>
        <Title order={1}>{formatLocalDate(localToday(), "long")}</Title>
      </ClientOnly>

      <TodayWidget />
    </Stack>
  );
}
