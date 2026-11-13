import { Badge, Box, NavLink, Stack, Text, Tooltip } from "@mantine/core";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { isNavigable, primaryNav, workspaceNav, type NavEntry } from "@web/lib/router/navigation";
import classes from "./app-shell.module.css";

export function AppNav({ pathname }: Readonly<{ pathname: string }>) {
  const { t } = useTranslation();

  return (
    <Stack gap="xl">
      <Stack gap={4}>
        <Text fz={11} fw={500} tt="uppercase" lts="1.2px" px={12} pb={8} visibleFrom="md">
          {t("nav.primary.label")}
        </Text>
        {primaryNav.map((entry) => (
          <NavItem
            key={entry.labelKey}
            entry={entry}
            active={isNavigable(entry) && entry.to === pathname}
          />
        ))}
      </Stack>

      <Stack gap={4}>
        <Text fz={11} fw={500} tt="uppercase" lts="1.2px" px={12} pb={8} visibleFrom="md">
          {t("nav.workspace.label")}
        </Text>
        {workspaceNav.map((entry) => (
          <NavItem key={entry.labelKey} entry={entry} active={false} />
        ))}
      </Stack>
    </Stack>
  );
}

export function NavItem({ entry, active }: Readonly<{ entry: NavEntry; active: boolean }>) {
  const { t } = useTranslation();
  const labelText = t(entry.labelKey);
  const leftSection = <entry.icon size={18} stroke={1.6} />;
  const label = (
    <Box component="span" visibleFrom="md">
      {labelText}
    </Box>
  );

  if (isNavigable(entry)) {
    return (
      <NavLink
        component={Link}
        to={entry.to}
        className={classes.navLink}
        label={label}
        leftSection={leftSection}
        active={active}
        noWrap
        aria-label={labelText}
        title={labelText}
        aria-current={active ? "page" : undefined}
      />
    );
  }

  const unavailable = { label: labelText, milestone: entry.milestone };

  return (
    <Tooltip label={t("comingSoon.title", unavailable)} position="right">
      <NavLink
        component="button"
        type="button"
        className={classes.navLink}
        label={label}
        leftSection={leftSection}
        rightSection={
          <Badge variant="default" size="xs" radius="xs" visibleFrom="md">
            {entry.milestone}
          </Badge>
        }
        disabled
        aria-label={t("comingSoon.ariaLabel", unavailable)}
      />
    </Tooltip>
  );
}
