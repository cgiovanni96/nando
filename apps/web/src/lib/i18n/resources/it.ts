export const it = {
  app: {
    name: "Nando",
    skipToContent: "Salta al contenuto",
  },
  comingSoon: {
    title: "{{label}} — disponibile in {{milestone}}",
    ariaLabel: "{{label}}, disponibile in {{milestone}}",
    short: "{{label}} — {{milestone}}",
  },
  nav: {
    primary: {
      label: "Navigazione",
      ariaLabel: "Navigazione principale",
    },
    workspace: {
      label: "Spazio",
    },
    items: {
      dashboard: "Dashboard",
      calendar: "Calendario",
      knowledge: "Knowledge",
      habits: "Habits",
      inbox: "Inbox",
      allSpaces: "Tutti gli Space",
    },
  },
  shell: {
    capture: "Cattura",
    search: "Cerca",
    create: "Nuovo",
    workspace: {
      name: "Spazio personale",
      role: "Owner",
    },
    theme: {
      toDark: "Passa al tema scuro",
      toLight: "Passa al tema chiaro",
    },
  },
  capture: {
    eyebrow: "Cattura",
    title: "Cattura rapida",
    description: "Scrivi il task e premi Invio. Lo Space è opzionale.",
    titleLabel: "Titolo del task",
    titlePlaceholder: "Cosa devi fare?",
    spaceLabel: "Space",
    spacePlaceholder: "Inbox",
    noSpaces: "Nessuno Space",
    submit: "Aggiungi",
    success: "Task creato.",
    error: "Non è stato possibile creare il task.",
    emptyTitle: "Scrivi il titolo del task.",
    spacesError: "Non è stato possibile caricare gli Space.",
  },
  dashboard: {
    eyebrow: "Dashboard",
    title: "Oggi",
    intro: "Cattura un task qui sotto; l'elenco di Oggi arriverà con il prossimo passo.",
    today: {
      title: "Nessun task per Oggi",
      description: "La cattura è attiva. L'elenco dei task di oggi arriverà presto.",
    },
  },
} as const;
