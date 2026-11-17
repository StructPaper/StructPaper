# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
RUN apk add --no-cache libc6-compat curl ca-certificates fontconfig freetype

# Install official Tectonic static musl binary for Linux x86_64
RUN curl -sL https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%400.15.0/tectonic-0.15.0-x86_64-unknown-linux-musl.tar.gz | tar -xz -C /usr/local/bin && \
    chmod +x /usr/local/bin/tectonic

# Fonts on the container filesystem (NOT a Windows bind mount: ~10x faster compiles)
COPY docker/fonts/ /usr/share/fonts/structpaper/
RUN fc-cache -f

WORKDIR /app

# Stage 1: Development target (Live code mount & Hot Reload)
FROM base AS dev
ENV NODE_ENV=development
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.json ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/
RUN pnpm install
EXPOSE 3001
CMD ["pnpm", "--filter", "@structpaper/api", "dev"]

# Stage 2: Builder target (Compile TypeScript)
FROM base AS builder
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.json ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @structpaper/api build

# Stage 3: Production Runner (Lean image)
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache libc6-compat fontconfig freetype ca-certificates
COPY --from=base /usr/local/bin/tectonic /usr/local/bin/tectonic
COPY docker/fonts/ /usr/share/fonts/structpaper/
RUN fc-cache -f
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

COPY --from=builder /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=builder /app/packages/ ./packages/
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist

RUN pnpm install --prod --frozen-lockfile

WORKDIR /app/apps/api
EXPOSE 3001
CMD ["node", "dist/apps/api/src/main.js"]
