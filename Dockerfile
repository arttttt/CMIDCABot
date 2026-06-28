# syntax=docker/dockerfile:1

# CMI DCA bot — multi-stage build producing a small linux/arm64 runtime image.
# Built in CI and pushed to GHCR; hosts only pull + run it (no build at deploy).

ARG NODE_VERSION=24

# --- builder: full deps (compiles native better-sqlite3) + tsc --------------
FROM node:${NODE_VERSION}-alpine AS builder
WORKDIR /app
# better-sqlite3 builds a native addon from source -> needs a toolchain.
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# --- deps: production-only node_modules (native addon, no dev deps) ----------
FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# --- runtime: slim image, non-root, data/ as a volume -----------------------
FROM node:${NODE_VERSION}-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Bind the HTTP server (health / one-time secret links) on all interfaces
# inside the container so the published port is reachable from the host.
ENV HTTP_HOST=0.0.0.0 \
    HTTP_PORT=8000
COPY --from=deps    /app/node_modules ./node_modules
COPY --from=builder /app/dist         ./dist
COPY package.json ./
# SQLite lives here, mounted as a named volume. Owned by `node` so a freshly
# created named volume inherits writable permissions.
RUN mkdir -p /app/data && chown -R node:node /app
USER node
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${HTTP_PORT}/health" >/dev/null 2>&1 || exit 1
CMD ["node", "dist/index.js"]
