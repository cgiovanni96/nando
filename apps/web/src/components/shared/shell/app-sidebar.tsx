import { AppShell as MantineAppShell, Box, Button, Group, Stack, Text } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";

import { AppNav } from "./app-nav";
import classes from "./app-shell.module.css";

export function AppSidebar({ pathname }: Readonly<{ pathname: string }>) {
  return (
    <MantineAppShell.Navbar
      className={classes.navbar}
      px={{ base: 12, md: 16 }}
      pt={{ base: 12, md: 24 }}
      pb={{ base: 12, md: 16 }}
      aria-label="Navigazione principale"
    >
      <Stack h="100%" gap="xl">
        <Group gap={10} px={8} wrap="nowrap">
          <Box className={classes.brandMark} aria-hidden="true">
            N
          </Box>
          <Text fz={22} fw={600} lts="-0.8px" visibleFrom="md">
            Nando
          </Text>
        </Group>

        <Button
          variant="default"
          fullWidth
          justify="flex-start"
          leftSection={<IconPlus size={16} stroke={1.6} />}
          disabled
          title="Cattura — disponibile in M1"
          aria-label="Cattura, disponibile in M1"
        >
          <Box component="span" visibleFrom="md">
            Cattura
          </Box>
        </Button>

        <Box flex={1} c="dimmed">
          <AppNav pathname={pathname} />
        </Box>

        <Group className={classes.userRow} gap="md" pt="md" wrap="nowrap">
          <Box className={classes.userMonogram} aria-hidden="true">
            N
          </Box>
          <Stack gap={0} visibleFrom="md">
            <Text fz="sm" fw={500}>
              Spazio personale
            </Text>
            <Text fz={11} c="dimmed">
              Owner
            </Text>
          </Stack>
        </Group>
      </Stack>
    </MantineAppShell.Navbar>
  );
}
