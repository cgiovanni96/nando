import { Button, EmptyState, Stack, Text, Title } from "@mantine/core";
import { IconLayoutDashboard, IconPlus } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

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

      <EmptyState
        className={classes.emptyState}
        p={{ base: 32, sm: 48 }}
        bdrs="lg"
        icon={<IconLayoutDashboard size={28} stroke={1.5} />}
        title={t("dashboard.empty.title")}
        description={t("dashboard.empty.description")}
      >
        <EmptyState.Actions>
          <Button variant="filled" leftSection={<IconPlus size={16} stroke={1.6} />} disabled>
            {t("dashboard.empty.action")}
          </Button>
        </EmptyState.Actions>
      </EmptyState>
    </Stack>
  );
}
