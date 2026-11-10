import { Badge, Box, NavLink, Stack, Text, Tooltip } from "@mantine/core";
import { Link } from "@tanstack/react-router";

import {
  isNavigable,
  primaryNav,
  workspaceNav,
  type NavEntry,
} from "../../../lib/router/navigation";
import classes from "./app-shell.module.css";

export function AppNav({ pathname }: Readonly<{ pathname: string }>) {
  return (
    <Stack gap="xl">
      <Stack gap={4}>
        <Text fz={11} fw={500} tt="uppercase" lts="1.2px" px={12} pb={8} visibleFrom="md">
          Navigazione
        </Text>
        {primaryNav.map((entry) => (
          <NavItem
            key={entry.label}
            entry={entry}
            active={isNavigable(entry) && entry.to === pathname}
          />
        ))}
      </Stack>

      <Stack gap={4}>
        <Text fz={11} fw={500} tt="uppercase" lts="1.2px" px={12} pb={8} visibleFrom="md">
          Spazio
        </Text>
        {workspaceNav.map((entry) => (
          <NavItem key={entry.label} entry={entry} active={false} />
        ))}
      </Stack>
    </Stack>
  );
}

function NavItem({ entry, active }: Readonly<{ entry: NavEntry; active: boolean }>) {
  const leftSection = <entry.icon size={18} stroke={1.6} />;
  const label = (
    <Box component="span" visibleFrom="md">
      {entry.label}
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
        aria-label={entry.label}
        title={entry.label}
        aria-current={active ? "page" : undefined}
      />
    );
  }

  return (
    <Tooltip label={`${entry.label} — disponibile in ${entry.milestone}`} position="right">
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
        aria-label={`${entry.label}, disponibile in ${entry.milestone}`}
      />
    </Tooltip>
  );
}
