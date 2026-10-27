# Domain Docs

This repository uses a single-context domain documentation layout.

## Before exploring

- Read `GLOSSARY.md` at the repository root, when present.
- Read relevant architectural decision records in `docs/adr/` before working in an area they cover.

If either is absent, proceed silently. The domain-modeling skill creates glossary entries and ADRs as terms and decisions are resolved; setup does not create placeholders.

## File structure

- `GLOSSARY.md`: shared domain vocabulary.
- `docs/adr/NNNN-short-title.md`: architectural decisions, numbered from `0001`.

## Use the glossary's vocabulary

Use the glossary's terms in issue titles, proposals, hypotheses, and test names. If a needed concept is absent, check whether an existing term already expresses it; record a real vocabulary gap for domain-modeling.

## Flag ADR conflicts

When a proposal contradicts an existing ADR, name the conflicting ADR and explain why the decision should be revisited.
