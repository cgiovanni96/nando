import { Stack, Tabs, Title } from "@mantine/core";
import { IconCheckbox } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

import { TrashTaskList } from "./trash-task-list";

export function TrashPage() {
  const { t } = useTranslation();

  return (
    <Stack gap="xl">
      <Title order={1}>{t("trash.title")}</Title>

      <Tabs defaultValue="tasks">
        <Tabs.List>
          <Tabs.Tab value="tasks" leftSection={<IconCheckbox size={16} stroke={1.6} />}>
            {t("trash.tabs.tasks")}
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="tasks" pt="md">
          <TrashTaskList />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
