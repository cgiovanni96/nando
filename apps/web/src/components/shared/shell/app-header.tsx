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

import { isNavigable, primaryNav } from "../../../lib/router/navigation";
import { ThemeToggle } from "./theme-toggle";

export function AppHeader({ pathname }: Readonly<{ pathname: string }>) {
  const currentLabel =
    primaryNav.find((entry) => isNavigable(entry) && entry.to === pathname)?.label ?? "Dashboard";

  return (
    <MantineAppShell.Header>
      <Group h="100%" gap="md" px={{ base: 16, sm: 32 }} wrap="nowrap">
        <Breadcrumbs flex={1} fz="xs" separator="/">
          <Text c="dimmed">Nando</Text>
          <Text>{currentLabel}</Text>
        </Breadcrumbs>

        <Button
          variant="subtle"
          size="xs"
          leftSection={<IconSearch size={16} stroke={1.6} />}
          rightSection={<Kbd size="xs">⌘K</Kbd>}
          disabled
          title="Ricerca — disponibile in M4b"
          aria-label="Ricerca, disponibile in M4b"
        >
          Cerca
        </Button>

        <ThemeToggle />

        <Button
          variant="filled"
          visibleFrom="sm"
          leftSection={<IconPlus size={16} stroke={1.6} />}
          disabled
          title="Nuovo — disponibile in M1"
        >
          Nuovo
        </Button>

        <ActionIcon
          hiddenFrom="sm"
          disabled
          aria-label="Nuovo, disponibile in M1"
          title="Nuovo — disponibile in M1"
        >
          <IconPlus size={18} stroke={1.6} />
        </ActionIcon>
      </Group>
    </MantineAppShell.Header>
  );
}
