import { Box, Group, Text, UnstyledButton } from "@mantine/core";
import { Link } from "@tanstack/react-router";

import { isNavigable, primaryNav, type NavEntry } from "../../../lib/router/navigation";
import classes from "./app-shell.module.css";

export function BottomNav({ pathname }: Readonly<{ pathname: string }>) {
  return (
    <Box component="nav" aria-label="Navigazione principale" className={classes.bottomNav}>
      <Group h="100%" c="dimmed" justify="space-around" gap="xs" px={8} wrap="nowrap">
        {primaryNav.map((entry) => (
          <BottomNavItem
            key={entry.label}
            entry={entry}
            active={isNavigable(entry) && entry.to === pathname}
          />
        ))}
      </Group>
    </Box>
  );
}

function BottomNavItem({ entry, active }: Readonly<{ entry: NavEntry; active: boolean }>) {
  const content = (
    <>
      <entry.icon size={20} stroke={1.6} />
      <Text component="span" fz={10} lh={1.2}>
        {entry.label}
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

  return (
    <UnstyledButton
      className={classes.bottomNavItem}
      disabled
      aria-label={`${entry.label}, disponibile in ${entry.milestone}`}
      title={`${entry.label} — ${entry.milestone}`}
    >
      {content}
    </UnstyledButton>
  );
}
