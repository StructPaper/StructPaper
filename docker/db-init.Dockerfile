# syntax=docker/dockerfile:1
FROM node:22-alpine AS runner

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
RUN apk add --no-cache libc6-compat postgresql-client

WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.json ./
COPY packages/ ./packages/

RUN pnpm install --frozen-lockfile

RUN chown -R node:node /app /pnpm
USER node

CMD ["/bin/sh", "-c", "pnpm --filter @structpaper/db migrate && pnpm --filter @structpaper/db seed"]
