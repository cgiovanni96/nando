const script = process.argv[2] ?? "unknown";

console.error(
  [
    `[nando] "${script}" non è ancora implementato.`,
    "",
    "Questo comando è parte del contratto di M0 ma appartiene a una fetta successiva:",
    "  - test:integration, db:migrate, db:check -> NAS-133 / NAS-134",
    "  - docs:check -> NAS-131",
    "",
    "Quando la fetta che lo possiede sarà implementata, il comando smetterà di fallire.",
  ].join("\n"),
);

process.exit(1);
