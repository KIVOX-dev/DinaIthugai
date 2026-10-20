# syntax=docker/dockerfile:1.7
# Dina Idhigai API (Express + MongoDB + Backblaze B2)

############ 1) dependencies (incl. dev, for the TypeScript build)
FROM node:26-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

############ 2) build
FROM deps AS build
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

############ 3) production-only dependencies
FROM node:26-bookworm-slim AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev

############ 4) runtime
FROM node:26-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=4000
WORKDIR /app
# curl is only used by the container HEALTHCHECK
RUN apt-get update && apt-get install -y --no-install-recommends curl tini \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /app/.data/uploads && chown -R node:node /app
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./
USER node
EXPOSE 4000
# Local-disk uploads (only used when B2 is not configured) live here; mount a volume for them in development.
VOLUME ["/app/.data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${X_ZOHO_CATALYST_LISTEN_PORT:-$PORT}/api/health" || exit 1
ENTRYPOINT ["/usr/bin/tini", "--"]
# Configuration comes from environment variables (see .env.example), not from a baked-in .env file.
CMD ["node", "dist/server.js"]
