import {
  ActionIcon,
  AppShell as MantineAppShell,
  Breadcrumbs,
  Button,
  Group,
  Kbd,
  Text,
} from "@mantine/core";
import { spotlight } from "@mantine/spotlight";
import { IconArrowLeft, IconArrowRight, IconPlus, IconSearch } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

import { useQuickCaptureModal } from "@web/components/shared/capture/quick-capture-provider";
import { useHistoryNavigation } from "@web/lib/router/history";
import { sectionLabelKey } from "@web/lib/router/navigation";
import { ThemeToggle } from "./theme-toggle";

export function AppHeader({ pathname }: Readonly<{ pathname: string }>) {
  const { t } = useTranslation();
  const history = useHistoryNavigation();
  const capture = useQuickCaptureModal();
  const currentLabel = t(sectionLabelKey(pathname) ?? "nav.items.dashboard");

  return (
    <MantineAppShell.Header>
      <Group h="100%" gap="md" px={{ base: 16, sm: 32 }} wrap="nowrap">
        <Group gap={2} wrap="nowrap">
          <ActionIcon
            variant="subtle"
            size="sm"
            disabled={!history.canGoBack}
            onClick={history.back}
            aria-label={t("shell.history.back")}
            title={t("shell.history.back")}
          >
            <IconArrowLeft size={18} stroke={1.6} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            size="sm"
            disabled={!history.canGoForward}
            onClick={history.forward}
            aria-label={t("shell.history.forward")}
            title={t("shell.history.forward")}
          >
            <IconArrowRight size={18} stroke={1.6} />
          </ActionIcon>
        </Group>

        <Breadcrumbs flex={1} fz="xs" separator="/">
          <Text c="dimmed">{t("app.name")}</Text>
          <Text>{currentLabel}</Text>
        </Breadcrumbs>

        <Button
          visibleFrom="sm"
          variant="subtle"
          size="xs"
          leftSection={<IconSearch size={16} stroke={1.6} />}
          rightSection={<Kbd size="xs">{t("commands.shortcuts.spotlight")}</Kbd>}
          onClick={() => spotlight.open()}
          aria-label={t("shell.search")}
          title={t("shell.search")}
        >
          {t("shell.search")}
        </Button>

        <ActionIcon
          hiddenFrom="sm"
          onClick={() => spotlight.open()}
          aria-label={t("shell.search")}
          title={t("shell.search")}
        >
          <IconSearch size={18} stroke={1.6} />
        </ActionIcon>

        <ThemeToggle />

        <Button
          visibleFrom="sm"
          variant="filled"
          leftSection={<IconPlus size={16} stroke={1.6} />}
          onClick={capture.open}
          aria-label={t("capture.title")}
          title={t("capture.title")}
        >
          {t("shell.create")}
        </Button>

        <ActionIcon
          hiddenFrom="sm"
          variant="filled"
          onClick={capture.open}
          aria-label={t("capture.title")}
          title={t("capture.title")}
        >
          <IconPlus size={18} stroke={1.6} />
        </ActionIcon>
      </Group>
    </MantineAppShell.Header>
  );
}
