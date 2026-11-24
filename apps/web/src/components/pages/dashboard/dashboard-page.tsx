import { Stack, Title } from "@mantine/core";

import { formatLocalDate } from "@web/lib/format/datetime";
import { localToday } from "./agenda-groups";
import { TodayWidget } from "./today-widget";

export function DashboardPage() {
  return (
    <Stack gap="xl">
      <Title order={1}>{formatLocalDate(localToday(), "long")}</Title>

      <TodayWidget />
    </Stack>
  );
}
