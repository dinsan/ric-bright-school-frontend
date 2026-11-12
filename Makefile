.DEFAULT_GOAL := help

.PHONY: help install dev lint typecheck tokens build check up down logs

help: ## Show this help
	@grep -E '^[a-z-]+:.*##' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  %-10s %s\n", $$1, $$2}'

install: ## Install dependencies exactly as locked
	npm ci

dev: ## Run the web app with hot reload on :3000
	npm run dev

lint: ## Lint the code
	npm run lint

typecheck: ## Type-check the code
	npm run typecheck

tokens: ## Check colour contrast of the design tokens
	npm run tokens:check

build: ## Production build
	npm run build

check: lint typecheck tokens build ## Lint, type-check, contrast check and build (run before pushing)

up: ## Build and run the web app in Docker on :3000
	docker compose up --build

down: ## Stop the Docker container
	docker compose down

logs: ## Follow the Docker container logs
	docker compose logs -f web
