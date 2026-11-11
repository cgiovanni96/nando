import { Box, Group, Text, UnstyledButton } from "@mantine/core";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { isNavigable, primaryNav, type NavEntry } from "../../../lib/router/navigation";
import classes from "./app-shell.module.css";

export function BottomNav({ pathname }: Readonly<{ pathname: string }>) {
  const { t } = useTranslation();

  return (
    <Box component="nav" aria-label={t("nav.primary.ariaLabel")} className={classes.bottomNav}>
      <Group h="100%" c="dimmed" justify="space-around" gap="xs" px={8} wrap="nowrap">
        {primaryNav.map((entry) => (
          <BottomNavItem
            key={entry.labelKey}
            entry={entry}
            active={isNavigable(entry) && entry.to === pathname}
          />
        ))}
      </Group>
    </Box>
  );
}

function BottomNavItem({ entry, active }: Readonly<{ entry: NavEntry; active: boolean }>) {
  const { t } = useTranslation();
  const content = (
    <>
      <entry.icon size={20} stroke={1.6} />
      <Text component="span" fz={10} lh={1.2}>
        {t(entry.labelKey)}
      </Text>
    </>
  );

  if (isNavigable(entry)) {
    return (
      <UnstyledButton
        component={Link}
        to={entry.to}
        className={classes.bottomNavItem}
        aria-current={active ? "page" : undefined}
      >
        {content}
      </UnstyledButton>
    );
  }

  const unavailable = { label: t(entry.labelKey), milestone: entry.milestone };

  return (
    <UnstyledButton
      className={classes.bottomNavItem}
      disabled
      aria-label={t("comingSoon.ariaLabel", unavailable)}
      title={t("comingSoon.short", unavailable)}
    >
      {content}
    </UnstyledButton>
  );
}
