# syntax=docker/dockerfile:1

# Lumina: one Next.js app (pages + API) on PostgreSQL. Targets:
#   dev      the development server with hot reload, used by compose.yaml (`docker compose up`)
#   runner   (default) the production server: Next.js standalone output, no dev dependencies
#   migrator applies the Prisma migrations in prisma/migrations (run once per deploy, before the runner
#            starts); `npm run db:seed` from the same image fills a development database
#   build    intermediate
#
#   docker build --build-arg SITE_URL=https://lumina.example -t lumina-web .
#   docker build --target migrator -t lumina-migrate .
#   docker run --rm -e DATABASE_URL=postgres://… lumina-migrate
#   docker run --rm -p 3000:3000 -e DATABASE_URL=postgres://… -e AUTH_SECRET=… -e APP_URL=https://… lumina-web
#
# Only the public address is baked in at build time (SITE_URL: canonical URLs, sitemap, share images live
# in prerendered HTML; without it the build is marked noindex). Everything else (database, secrets, OAuth
# keys, SMTP) is read when the container starts.

# --- Development -----------------------------------------------------------------------------------
# The source code is not copied: compose.yaml mounts your checkout at /app, so edits reload instantly.
# Dependencies are installed here and kept in a volume (node_modules built for Linux, not your machine).
# OpenSSL: the Prisma CLI (migrations) picks its schema engine build by the OpenSSL version.
FROM node:22-alpine AS dev
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=development \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
# Owned by the unprivileged `node` user, so the volumes created from these folders are too.
RUN mkdir -p /app/node_modules /app/.next && chown -R node:node /app
USER node
# The Prisma schema and config too: `npm ci` runs `prisma generate` (postinstall). The client generated
# here is hidden by the mounted checkout; the entrypoint generates it again in src/generated.
COPY --chown=node:node package.json package-lock.json prisma.config.ts ./
COPY --chown=node:node prisma ./prisma
RUN --mount=type=cache,target=/home/node/.npm,uid=1000,gid=1000 npm ci --no-audit --no-fund \
 && sha256sum package-lock.json > node_modules/.package-lock.sha256
# After the install, so editing the script doesn't reinstall dependencies. Windows line endings (from a
# checkout with autocrlf) are stripped, or the shell would refuse the script.
USER root
COPY --chmod=755 scripts/docker/dev-entrypoint.sh /usr/local/bin/lumina-dev-entrypoint
RUN sed -i 's/\r$//' /usr/local/bin/lumina-dev-entrypoint
USER node
EXPOSE 3000
ENTRYPOINT ["lumina-dev-entrypoint"]
CMD ["npm", "run", "dev"]

# --- Production ------------------------------------------------------------------------------------
FROM node:22-alpine AS deps
RUN apk add --no-cache openssl
WORKDIR /app
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

FROM node:22-alpine AS build
WORKDIR /app
# The public address (https://lumina.example). Leave empty for a local or preview image: it is then
# kept out of search engines. SITE_NOINDEX=true does the same for a staging site with a real address.
ARG SITE_URL=""
ARG SITE_NOINDEX=""
ENV NEXT_TELEMETRY_DISABLED=1 \
    SITE_URL=$SITE_URL \
    SITE_NOINDEX=$SITE_NOINDEX
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/src/generated ./src/generated
COPY . .
RUN npm run build

# The Prisma CLI and tsx (dev dependencies) run here, not in the runner.
FROM build AS migrator
RUN apk add --no-cache openssl
USER node
CMD ["npm", "run", "db:migrate"]

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S lumina && adduser -S lumina -G lumina
COPY --from=build --chown=lumina:lumina /app/public ./public
COPY --from=build --chown=lumina:lumina /app/.next/standalone ./
COPY --from=build --chown=lumina:lumina /app/.next/static ./.next/static
USER lumina
EXPOSE 3000
# /api/health answers 200 only when the database does.
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
    CMD wget -q --spider http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "server.js"]
