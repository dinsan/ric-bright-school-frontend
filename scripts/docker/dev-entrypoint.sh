#!/bin/sh
# Starts the development container (compose.yaml, service "app"). Runs before the command
# (by default `npm run dev`), so that `docker compose up` on a fresh clone is all it takes:
#   1. dependencies: installed in the image; reinstalled here only if package-lock.json changed since
#      (after a `git pull`, for example), because node_modules lives in a Docker volume;
#   2. Prisma Client: generated into src/generated (part of your checkout, but not of the image);
#   3. database: applies the migrations in prisma/migrations (compose waits until PostgreSQL is healthy);
#   4. sample data: the catalog and demo accounts (idempotent; SEED_ON_START=false to skip).
set -e
cd /app

log() { printf '\033[1;34m[lumina]\033[0m %s\n' "$*"; }

if ! sha256sum -c node_modules/.package-lock.sha256 >/dev/null 2>&1; then
  log "package-lock.json changed: installing dependencies (this takes a minute)…"
  # `npm install` rather than `npm ci`: ci deletes node_modules itself, which is a volume mount here.
  npm install --no-audit --no-fund
  sha256sum package-lock.json > node_modules/.package-lock.sha256
fi

log "generating the Prisma Client…"
npm run --silent db:client >/dev/null

log "applying database migrations…"
npm run --silent db:migrate

if [ "${SEED_ON_START:-true}" = "true" ]; then
  log "adding sample courses and demo accounts (skipped when they exist)…"
  npm run --silent db:seed
fi

log "ready: app http://localhost:${APP_PORT:-3000} · emails http://localhost:${MAIL_UI_PORT:-8025}"
exec "$@"
