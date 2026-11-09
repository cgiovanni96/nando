const script = process.argv[2] ?? "unknown";

console.error(
  [
    `[nando] "${script}" non è ancora implementato.`,
    "",
    "Questo comando è parte del contratto di M0 ma appartiene a una fetta successiva:",
    "  - docs:check -> NAS-131",
    "",
    "Quando la fetta che lo possiede sarà implementata, il comando smetterà di fallire.",
  ].join("\n"),
);

process.exit(1);
