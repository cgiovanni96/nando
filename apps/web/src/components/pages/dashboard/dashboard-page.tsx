import { EmptyState, Stack, Text, Title } from "@mantine/core";
import { IconCalendarEvent } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

import { QuickCaptureCard } from "../../shared/capture/quick-capture-card";
import classes from "./dashboard-page.module.css";

export function DashboardPage() {
  const { t } = useTranslation();

  return (
    <Stack gap="xl">
      <Stack gap={8}>
        <Text fz="xs" c="dimmed">
          {t("dashboard.eyebrow")}
        </Text>
        <Title order={1}>{t("dashboard.title")}</Title>
        <Text c="dimmed" maw={560}>
          {t("dashboard.intro")}
        </Text>
      </Stack>

      <QuickCaptureCard />

      <EmptyState
        className={classes.emptyState}
        p={{ base: 32, sm: 48 }}
        bdrs="lg"
        icon={<IconCalendarEvent size={28} stroke={1.5} />}
        title={t("dashboard.today.title")}
        description={t("dashboard.today.description")}
      />
    </Stack>
  );
}
