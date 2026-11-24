import { Badge, Card, Center, Loader, Tabs, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { agendaQueryOptions } from "@web/lib/queries/agenda";
import { NEXT_DAYS, addDays, groupNextDays, groupToday, localToday } from "./agenda-groups";
import { NextDaysPanel } from "./next-days-panel";
import { TodayPanel } from "./today-panel";

export function TodayWidget() {
  const { t } = useTranslation();
  const isBrowser = typeof window !== "undefined";
  const today = localToday();
  const agenda = useQuery({
    ...agendaQueryOptions({ from: today, to: addDays(today, NEXT_DAYS) }),
    enabled: isBrowser,
  });
  const items = agenda.data ?? [];
  const todayGroups = groupToday(items, today);
  const nextDays = groupNextDays(items, today);

  return (
    <Card>
      <Tabs defaultValue="today">
        <Tabs.List>
          <Tabs.Tab
            value="today"
            rightSection={
              agenda.isPending ? null : (
                <Badge component="span" variant="light" size="sm" color="gray">
                  {todayGroups.total}
                </Badge>
              )
            }
          >
            {t("dashboard.today.tab")}
          </Tabs.Tab>
          <Tabs.Tab
            value="next"
            rightSection={
              agenda.isPending ? null : (
                <Badge component="span" variant="light" size="sm" color="gray">
                  {nextDays.total}
                </Badge>
              )
            }
          >
            {t("dashboard.next.tab")}
          </Tabs.Tab>
        </Tabs.List>

        {agenda.isPending ? (
          <Center py="md">
            <Loader size="sm" aria-label={t("dashboard.agenda.loading")} />
          </Center>
        ) : null}

        {agenda.isError ? <Text c="red">{t("dashboard.agenda.error")}</Text> : null}

        <Tabs.Panel value="today" pt="md">
          {agenda.isSuccess ? (
            <TodayPanel groups={todayGroups.groups} total={todayGroups.total} today={today} />
          ) : null}
        </Tabs.Panel>

        <Tabs.Panel value="next" pt="md">
          {agenda.isSuccess ? <NextDaysPanel days={nextDays.days} /> : null}
        </Tabs.Panel>
      </Tabs>
    </Card>
  );
}
