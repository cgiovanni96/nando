import {
  ActionIcon,
  AppShell as MantineAppShell,
  Breadcrumbs,
  Button,
  Group,
  Kbd,
  Text,
} from "@mantine/core";
import { IconPlus, IconSearch } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

import { isNavigable, primaryNav } from "../../../lib/router/navigation";
import { ThemeToggle } from "./theme-toggle";

export function AppHeader({ pathname }: Readonly<{ pathname: string }>) {
  const { t } = useTranslation();
  const currentEntry = primaryNav.find((entry) => isNavigable(entry) && entry.to === pathname);
  const currentLabel = t(currentEntry?.labelKey ?? "nav.items.dashboard");
  const searchUnavailable = { label: t("shell.search"), milestone: "M4b" };
  const createUnavailable = { label: t("shell.create"), milestone: "M1" };

  return (
    <MantineAppShell.Header>
      <Group h="100%" gap="md" px={{ base: 16, sm: 32 }} wrap="nowrap">
        <Breadcrumbs flex={1} fz="xs" separator="/">
          <Text c="dimmed">{t("app.name")}</Text>
          <Text>{currentLabel}</Text>
        </Breadcrumbs>

        <Button
          variant="subtle"
          size="xs"
          leftSection={<IconSearch size={16} stroke={1.6} />}
          rightSection={<Kbd size="xs">⌘K</Kbd>}
          disabled
          title={t("comingSoon.title", searchUnavailable)}
          aria-label={t("comingSoon.ariaLabel", searchUnavailable)}
        >
          {t("shell.search")}
        </Button>

        <ThemeToggle />

        <Button
          variant="filled"
          visibleFrom="sm"
          leftSection={<IconPlus size={16} stroke={1.6} />}
          disabled
          title={t("comingSoon.title", createUnavailable)}
        >
          {t("shell.create")}
        </Button>

        <ActionIcon
          hiddenFrom="sm"
          disabled
          aria-label={t("comingSoon.ariaLabel", createUnavailable)}
          title={t("comingSoon.title", createUnavailable)}
        >
          <IconPlus size={18} stroke={1.6} />
        </ActionIcon>
      </Group>
    </MantineAppShell.Header>
  );
}
