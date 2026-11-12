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

import { isNavigable, primaryNav } from "@web/lib/router/navigation";
import { QuickCapturePopover } from "@web/components/shared/capture/quick-capture-popover";
import { ThemeToggle } from "./theme-toggle";

export function AppHeader({ pathname }: Readonly<{ pathname: string }>) {
  const { t } = useTranslation();
  const currentEntry = primaryNav.find((entry) => isNavigable(entry) && entry.to === pathname);
  const currentLabel = t(currentEntry?.labelKey ?? "nav.items.dashboard");
  const searchUnavailable = { label: t("shell.search"), milestone: "M4b" };

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

        <QuickCapturePopover>
          <Button
            variant="filled"
            visibleFrom="sm"
            leftSection={<IconPlus size={16} stroke={1.6} />}
            aria-label={t("capture.title")}
            title={t("capture.title")}
          >
            {t("shell.create")}
          </Button>
        </QuickCapturePopover>

        <QuickCapturePopover>
          <ActionIcon
            hiddenFrom="sm"
            variant="filled"
            aria-label={t("capture.title")}
            title={t("capture.title")}
          >
            <IconPlus size={18} stroke={1.6} />
          </ActionIcon>
        </QuickCapturePopover>
      </Group>
    </MantineAppShell.Header>
  );
}
