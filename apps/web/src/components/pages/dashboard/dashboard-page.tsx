import { Button, EmptyState, Stack, Text, Title } from "@mantine/core";
import { IconLayoutDashboard, IconPlus } from "@tabler/icons-react";

import classes from "./dashboard-page.module.css";

export function DashboardPage() {
  return (
    <Stack gap="xl">
      <Stack gap={8}>
        <Text fz="xs" c="dimmed">
          Dashboard
        </Text>
        <Title order={1}>Oggi</Title>
        <Text c="dimmed" maw={560}>
          La dashboard si popola con M1: cattura, Inbox e Oggi. Per ora c&apos;è solo la shell,
          senza widget e senza dati finti.
        </Text>
      </Stack>

      <EmptyState
        className={classes.emptyState}
        p={{ base: 32, sm: 48 }}
        bdrs="lg"
        icon={<IconLayoutDashboard size={28} stroke={1.5} />}
        title="Nessun widget ancora"
        description="La dashboard è vuota per scelta. Il primo widget arriva con la cattura dei task in M1, poi Oggi e Prossimi sette giorni in M2."
      >
        <EmptyState.Actions>
          <Button variant="filled" leftSection={<IconPlus size={16} stroke={1.6} />} disabled>
            Nuovo task
          </Button>
        </EmptyState.Actions>
      </EmptyState>
    </Stack>
  );
}
