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
  inbox: {
    eyebrow: "Inbox",
    title: "Da collocare",
    intro:
      "I task senza Space. Spostane uno in un progetto o cancellalo: resta nel cestino per 7 giorni.",
    list: {
      eyebrow: "Task in Inbox",
      loading: "Caricamento dei task in Inbox",
      error: "Non è stato possibile caricare l'Inbox.",
    },
    empty: {
      title: "Inbox vuota",
      description: "Ogni task ha uno Space. Qui compaiono quelli che non ne hanno ancora uno.",
    },
    actions: {
      move: "Sposta in uno Space",
      moveAria: "Sposta il task {{title}} in uno Space",
      noSpaces: "Nessuno Space disponibile",
      deleteAria: "Cancella il task {{title}}",
    },
    delete: {
      title: "Cancellare il task?",
      description: 'Il task "{{title}}" sparirà dalle liste e resterà ripristinabile per 7 giorni.',
      cancel: "Annulla",
      confirm: "Cancella",
    },
    moved: "Task spostato.",
    moveError: "Non è stato possibile spostare il task.",
    deleted: "Task cancellato: resta nel cestino per 7 giorni.",
    deleteError: "Non è stato possibile cancellare il task.",
    restored: "Task ripristinato.",
    restoreError: "Non è stato possibile ripristinare il task.",
    trash: {
      eyebrow: "Cestino",
      description: "Task cancellati, ripristinabili entro la finestra di grazia.",
      restorableUntil: "Ripristinabile fino al {{date}}",
      restore: "Ripristina",
    },
  },
} as const;
