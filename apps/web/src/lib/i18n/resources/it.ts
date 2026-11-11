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
  dashboard: {
    eyebrow: "Dashboard",
    title: "Oggi",
    intro:
      "La dashboard si popola con M1: cattura, Inbox e Oggi. Per ora c'è solo la shell, senza widget e senza dati finti.",
    empty: {
      title: "Nessun widget ancora",
      description:
        "La dashboard è vuota per scelta. Il primo widget arriva con la cattura dei task in M1, poi Oggi e Prossimi sette giorni in M2.",
      action: "Nuovo task",
    },
  },
} as const;
