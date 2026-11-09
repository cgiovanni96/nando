import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: DashboardPlaceholder,
});

function DashboardPlaceholder() {
  return (
    <main className="placeholder">
      <p className="eyebrow">M0 · Fondazione</p>
      <h1>Nando</h1>
      <p>La shell arriva con NAS-135. Qui non c'è ancora nessun flusso utente.</p>
    </main>
  );
}
