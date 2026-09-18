# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS build
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@10.16.1 --activate
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build
RUN pnpm --filter @box/api deploy --legacy --prod /out/api && pnpm --filter @box/worker deploy --legacy --prod /out/worker

FROM node:22-bookworm-slim AS api
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out/api ./
USER node
EXPOSE 3002
CMD ["node", "dist/main.js"]

FROM node:22-bookworm-slim AS worker
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out/worker ./
USER node
EXPOSE 3003
CMD ["node", "dist/main.js"]

FROM node:22-bookworm-slim AS web
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]

FROM node:22-bookworm-slim AS admin
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3001
WORKDIR /app
COPY --from=build --chown=node:node /app/apps/admin/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/admin/.next/static ./apps/admin/.next/static
USER node
EXPOSE 3001
CMD ["node", "apps/admin/server.js"]
