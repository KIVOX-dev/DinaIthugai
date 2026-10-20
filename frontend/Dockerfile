# syntax=docker/dockerfile:1.7
# Dina Idhigai web (Next.js, standalone output). Production hosting is Vercel; this image is for self-hosting / local compose.

############ 1) dependencies
FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

############ 2) build
FROM node:24-bookworm-slim AS build
WORKDIR /app
# These are read at BUILD time: next.config.ts bakes the /api/* rewrite target into the routes manifest.
ARG BACKEND_URL=http://backend:4000
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ENV BACKEND_URL=$BACKEND_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_OUTPUT=standalone \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

############ 3) runtime
FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends curl tini \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -fsS http://127.0.0.1:${PORT}/ta -o /dev/null || exit 1
ENTRYPOINT ["/usr/bin/tini", "--"]
# BACKEND_URL for server-side fetches is read at runtime; set it on the container as well.
CMD ["node", "server.js"]
