# syntax=docker/dockerfile:1
# Build context: repository root (see docker-compose.yml).
FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --filter @split-and-go/api...
COPY tsconfig.base.json ./
COPY apps/api apps/api
RUN pnpm --filter @split-and-go/api build
# Production-only dependencies; prisma is a runtime dependency (migrate deploy).
RUN pnpm --filter @split-and-go/api deploy --prod /out \
  && cd /out && pnpm exec prisma generate

FROM node:24-alpine AS runtime
ENV NODE_ENV=production PORT=3001
WORKDIR /app
COPY --from=build --chown=node:node /out/node_modules ./node_modules
COPY --from=build --chown=node:node /out/package.json ./package.json
COPY --from=build --chown=node:node /repo/apps/api/dist ./dist
COPY --from=build --chown=node:node /repo/apps/api/prisma ./prisma
COPY --from=build --chown=node:node /repo/apps/api/prisma.config.ts ./prisma.config.ts
USER node
EXPOSE 3001
# Apply pending migrations, then start the server.
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/main.js"]
