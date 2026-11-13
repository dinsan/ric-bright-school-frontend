.DEFAULT_GOAL := help

# Development in Docker (compose.yaml): no Node.js or PostgreSQL needed on your machine.
COMPOSE := docker compose
APP := $(COMPOSE) exec app

.PHONY: help up start stop down reset logs shell test test-unit psql rebuild migrate seed db-generate db-check \
        prod-up prod-down install dev lint typecheck tokens build check db db-migrate db-seed db-studio

help: ## Show this help
	@grep -E '^[a-z-]+:.*##' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  %-12s %s\n", $$1, $$2}'

# --- Docker (recommended) ---------------------------------------------------------------------------

up: ## Start everything (database, email inbox, app with hot reload) and follow the logs
	$(COMPOSE) up

start: ## Start everything in the background
	$(COMPOSE) up -d
	@echo "App: http://localhost:$${APP_PORT:-3000}  Emails: http://localhost:$${MAIL_UI_PORT:-8025}  Logs: make logs"

stop: ## Stop the containers (keeps them and the data)
	$(COMPOSE) stop

down: ## Remove the containers (the database is kept)
	$(COMPOSE) down

reset: ## Remove the containers AND the data (database, node_modules, build cache), then start fresh
	$(COMPOSE) down -v
	$(COMPOSE) up --build

logs: ## Follow the app's logs
	$(COMPOSE) logs -f app

shell: ## A shell in the app container (npm, npx prisma, …)
	$(APP) sh

test: ## All tests in the app container: unit, components and API (the API tests use their own database)
	$(APP) npm test

test-unit: ## Only the fast tests (unit and components, no database)
	$(APP) npm run test:unit

psql: ## PostgreSQL prompt on the development database
	$(COMPOSE) exec db psql -U lumina -d lumina

rebuild: ## Rebuild the app image (after changing the Dockerfile)
	$(COMPOSE) up --build -d app

migrate: ## Apply new migrations (also done on every start)
	$(APP) npm run db:migrate

seed: ## Add the sample data and demo accounts again (also done on every start)
	$(APP) npm run db:seed

db-generate: ## Write a migration after changing prisma/schema.prisma (NAME=add_something), then `make migrate`
	$(APP) npm run db:generate -- $(if $(NAME),--name $(NAME),)
	$(APP) npm run db:client

db-check: ## Check that the database matches prisma/schema.prisma (no missing migration)
	$(APP) npm run db:check

prod-up: ## Production-like run: built image, no hot reload (needs AUTH_SECRET in .env)
	$(COMPOSE) -f compose.prod.yaml up --build

prod-down: ## Stop the production-like run
	$(COMPOSE) -f compose.prod.yaml down

# --- Without Docker (Node.js 22 and PostgreSQL on your machine) ----------------------------------------

install: ## npm ci
	npm ci

dev: ## Dev server on your machine (needs DATABASE_URL, see .env.example; `make db` for a database)
	npm run dev

db: ## Only PostgreSQL and the email inbox in Docker, for `make dev`
	$(COMPOSE) up -d db mail

db-migrate: ## Apply migrations (on your machine)
	npm run db:migrate

db-seed: ## Sample data and demo accounts (on your machine)
	npm run db:seed

db-studio: ## Browse the database in Prisma Studio (on your machine)
	npm run db:studio

lint: ## Lint the code
	npm run lint

typecheck: ## Type-check the code
	npm run typecheck

tokens: ## Check colour contrast of the design tokens
	npm run tokens:check

build: ## Production build
	npm run build

check: lint typecheck tokens build ## Lint, type-check, contrast check and build (run `make test` too)
