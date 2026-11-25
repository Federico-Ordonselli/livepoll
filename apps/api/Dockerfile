# Build context: repository root (see docker-compose.yml).

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

# ---- build: install workspace deps, compile shared + api ----
FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter "@livepoll/api..." --ignore-scripts \
 && pnpm rebuild @swc/core
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @livepoll/shared build \
 && pnpm --filter @livepoll/api build \
 && pnpm --filter @livepoll/api deploy --prod --legacy /out \
 && cp -r apps/api/build /out/build

# ---- runtime: compiled JS + production deps only ----
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out ./
COPY apps/api/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod 755 /usr/local/bin/docker-entrypoint.sh && mkdir -p /data && chown node:node /data
USER node
EXPOSE 3333
HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3333/api/health || exit 1
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "build/bin/server.js"]
