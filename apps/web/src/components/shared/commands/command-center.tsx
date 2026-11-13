import { Kbd, useComputedColorScheme, useMantineColorScheme } from "@mantine/core";
import type { SpotlightActionData, SpotlightActionGroupData } from "@mantine/spotlight";
import { Spotlight } from "@mantine/spotlight";
import {
  IconArrowLeft,
  IconArrowRight,
  IconMoon,
  IconPlus,
  IconSearch,
  IconSun,
} from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { useQuickCaptureModal } from "@web/components/shared/capture/quick-capture-provider";
import type { AppPath } from "@web/lib/router/paths";
import { useHistoryNavigation } from "@web/lib/router/history";
import { allNav, isNavigable } from "@web/lib/router/navigation";
import { usePageActions } from "./page-actions-context";

/**
 * Comandi globali e azioni della pagina corrente in un'unica palette.
 * Le azioni non disponibili non entrano nella lista: Spotlight non supporta
 * voci disabilitate, mentre il menu del task le mostra comunque spente.
 */
export function CommandCenter() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const history = useHistoryNavigation();
  const capture = useQuickCaptureModal();
  const pageActions = usePageActions();
  const { setColorScheme } = useMantineColorScheme();
  const dark = useComputedColorScheme("light", { getInitialValueInEffect: true }) === "dark";

  const leaderShortcuts: Partial<Record<AppPath, string>> = {
    "/": t("commands.shortcuts.dashboard"),
    "/inbox": t("commands.shortcuts.inbox"),
    "/trash": t("commands.shortcuts.trash"),
  };

  const goTo: SpotlightActionData[] = allNav.filter(isNavigable).map((entry) => {
    const shortcut = leaderShortcuts[entry.to];
    const id = entry.to === "/" ? "dashboard" : entry.to.slice(1);

    return {
      id: `nav-${id}`,
      label: t(entry.labelKey),
      leftSection: <entry.icon size={18} stroke={1.6} />,
      ...(shortcut ? { rightSection: <Kbd size="xs">{shortcut}</Kbd> } : {}),
      onClick: () => void navigate({ to: entry.to }),
    };
  });

  if (history.canGoBack) {
    goTo.push({
      id: "history-back",
      label: t("shell.history.back"),
      leftSection: <IconArrowLeft size={18} stroke={1.6} />,
      rightSection: <Kbd size="xs">{t("commands.shortcuts.back")}</Kbd>,
      onClick: history.back,
    });
  }

  if (history.canGoForward) {
    goTo.push({
      id: "history-forward",
      label: t("shell.history.forward"),
      leftSection: <IconArrowRight size={18} stroke={1.6} />,
      rightSection: <Kbd size="xs">{t("commands.shortcuts.forward")}</Kbd>,
      onClick: history.forward,
    });
  }

  const page: SpotlightActionData[] = pageActions
    .filter((action) => !action.disabled)
    .map((action) => ({
      id: `page-${action.id}`,
      label: action.label,
      leftSection: action.icon,
      ...(action.shortcut ? { rightSection: <Kbd size="xs">{action.shortcut}</Kbd> } : {}),
      onClick: action.onTrigger,
    }));

  const actions: (SpotlightActionData | SpotlightActionGroupData)[] = [
    { group: t("commands.groups.goTo"), actions: goTo },
    ...(page.length > 0 ? [{ group: t("commands.groups.page"), actions: page }] : []),
    {
      group: t("commands.groups.actions"),
      actions: [
        {
          id: "capture",
          label: t("commands.actions.newTask"),
          leftSection: <IconPlus size={18} stroke={1.6} />,
          rightSection: <Kbd size="xs">{t("commands.shortcuts.capture")}</Kbd>,
          onClick: capture.open,
        },
      ],
    },
    {
      group: t("commands.groups.appearance"),
      actions: [
        {
          id: "theme",
          label: t(dark ? "shell.theme.toLight" : "shell.theme.toDark"),
          leftSection: dark ? (
            <IconSun size={18} stroke={1.6} />
          ) : (
            <IconMoon size={18} stroke={1.6} />
          ),
          onClick: () => setColorScheme(dark ? "light" : "dark"),
        },
      ],
    },
  ];

  return (
    <Spotlight
      actions={actions}
      title={t("commands.title")}
      nothingFound={t("commands.nothingFound")}
      highlightQuery
      scrollable
      maxHeight={420}
      size={640}
      zIndex={300}
      shortcut={null}
      searchProps={{
        leftSection: <IconSearch size={18} stroke={1.6} />,
        placeholder: t("commands.placeholder"),
      }}
    />
  );
}
