import { Button, Paper, Text, Title } from "@mantine/core";
import { IconLayoutDashboard, IconPlus } from "@tabler/icons-react";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <>
      <header className="page-heading">
        <div>
          <Text className="eyebrow">Dashboard</Text>
          <Title order={1}>Oggi</Title>
          <Text className="page-subtitle">
            La dashboard si popola con M1: cattura, Inbox e Oggi. Per ora c&apos;è solo la shell,
            senza widget e senza dati finti.
          </Text>
        </div>
      </header>

      <Paper className="empty-state">
        <div className="empty-icon" aria-hidden="true">
          <IconLayoutDashboard size={28} stroke={1.5} />
        </div>
        <Title order={2}>Nessun widget ancora</Title>
        <Text size="sm">
          La dashboard è vuota per scelta. Il primo widget arriva con la cattura dei task in M1, poi
          Oggi e Prossimi sette giorni in M2.
        </Text>
        <Button leftSection={<IconPlus size={16} stroke={1.6} />} disabled>
          Nuovo task
        </Button>
      </Paper>
    </>
  );
}
