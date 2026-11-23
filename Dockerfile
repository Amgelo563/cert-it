# syntax=docker/dockerfile:1

ARG NODE_VERSION=24.12.0

FROM node:${NODE_VERSION}-alpine AS build

RUN apk add --no-cache python3 make g++
RUN corepack enable

ENV CI=true COREPACK_ENABLE_DOWNLOAD_PROMPT=0 VP_GIT_HOOKS=0
WORKDIR /repo

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm fetch

COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --offline \
 && pnpm build \
 && pnpm --filter @cert-it/server deploy --prod /out/server

FROM node:${NODE_VERSION}-alpine

# User and group the app runs as. The data directory must be writable by them,
# and nginx's user must be in the group to serve PDFs with files.serve: accel.
ARG APP_UID=1000
ARG APP_GID=1000

RUN deluser --remove-home node \
 && (delgroup node 2>/dev/null || true) \
 && (getent group "${APP_GID}" >/dev/null || addgroup -S -g "${APP_GID}" cert-it) \
 && adduser -S -D -H -u "${APP_UID}" -G "$(getent group "${APP_GID}" | cut -d: -f1)" cert-it

ENV NODE_ENV=production

WORKDIR /app

COPY --from=build /out/server/package.json ./
COPY --from=build /out/server/node_modules ./node_modules
COPY --from=build /out/server/dist ./dist
COPY --from=build /out/server/drizzle ./drizzle
COPY --from=build /repo/apps/admin/dist /admin/dist
COPY --from=build /repo/apps/public/dist /public/dist

# Mount the config directory at /app/config and the data directory at /app/data.
RUN mkdir -p config data && chown "${APP_UID}:${APP_GID}" data

USER ${APP_UID}:${APP_GID}

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/healthz || exit 1

CMD ["node", "--max-old-space-size=96", "dist/index.mjs"]
