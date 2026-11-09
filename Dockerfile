# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable && corepack prepare pnpm@11.7.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/capability-habits/package.json packages/capability-habits/package.json
COPY packages/capability-knowledge/package.json packages/capability-knowledge/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/kernel/package.json packages/kernel/package.json
COPY packages/platform/package.json packages/platform/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm build

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV PORT=3001
ENV MIGRATIONS_DIR=/app/migrations
WORKDIR /app

RUN groupadd --system --gid 1001 nando \
  && useradd --system --uid 1001 --gid nando --home-dir /app nando

COPY --from=build --chown=nando:nando /app/apps/web/.output /app/web
COPY --from=build --chown=nando:nando /app/apps/api/dist /app/api
COPY --from=build --chown=nando:nando /app/apps/worker/dist /app/worker
COPY --from=build --chown=nando:nando /app/packages/platform/drizzle /app/migrations

USER nando
EXPOSE 3000 3001 3002

# Comandi: start:web (default), start:api, start:worker, start:migrate.
CMD ["node", "/app/web/server/index.mjs"]
