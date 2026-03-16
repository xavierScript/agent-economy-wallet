.DEFAULT_GOAL := help

# ── Variables ────────────────────────────────────────────────────────────────
CLI_DIST  := packages/cli/dist/index.js
MCP_DIST  := packages/mcp-server/dist/index.js

# ── Help ─────────────────────────────────────────────────────────────────────
.PHONY: help
help:
	@echo.
	@echo  agent-economy-wallet — available targets
	@echo  ────────────────────────────────────────────────────────────
	@echo  make install        Install all dependencies (pnpm install)
	@echo.
	@echo  make build          Build all packages (core → cli → mcp-server)
	@echo  make build-core     Build wallet-core only
	@echo  make build-cli      Build CLI only
	@echo  make build-mcp      Build MCP server only
	@echo.
	@echo  make dev            Watch all packages in parallel
	@echo  make dev-core       Watch wallet-core
	@echo  make dev-cli        Watch CLI
	@echo  make dev-mcp        Watch MCP server
	@echo.
	@echo  make test           Run all tests
	@echo  make test-watch     Run tests in watch mode
	@echo.
	@echo  make start          Build everything then launch the TUI
	@echo  make cli            Build CLI then launch the TUI
	@echo  make mcp            Build MCP server then run it
	@echo.
	@echo  make clean          Remove all dist/ folders
	@echo  make clean-core     Remove wallet-core/dist
	@echo  make clean-cli      Remove cli/dist
	@echo  make clean-mcp      Remove mcp-server/dist
	@echo.
	@echo  make rebuild        clean + build
	@echo.
	@echo  Docker targets
	@echo  ────────────────────────────────────────────────────────────
	@echo  make docker-build   Build the Docker image (no cache)
	@echo  make docker-up      Build image and launch the TUI container
	@echo  make docker-down    Stop and remove containers
	@echo  make docker-clean   Stop containers and remove the wallet-data volume
	@echo  ────────────────────────────────────────────────────────────
	@echo.

# ── Install ──────────────────────────────────────────────────────────────────
.PHONY: install
install:
	pnpm install

# ── Build ────────────────────────────────────────────────────────────────────
.PHONY: build
build:
	pnpm --filter @agent-economy-wallet/core build
	pnpm --filter @agent-economy-wallet/cli build
	pnpm --filter @agent-economy-wallet/mcp-server build

.PHONY: build-core
build-core:
	pnpm --filter @agent-economy-wallet/core build

.PHONY: build-cli
build-cli:
	pnpm --filter @agent-economy-wallet/cli build

.PHONY: build-mcp
build-mcp:
	pnpm --filter @agent-economy-wallet/mcp-server build

# ── Dev (watch) ──────────────────────────────────────────────────────────────
.PHONY: dev
dev:
	pnpm -r --parallel dev

.PHONY: dev-core
dev-core:
	pnpm --filter @agent-economy-wallet/core dev

.PHONY: dev-cli
dev-cli:
	pnpm --filter @agent-economy-wallet/cli dev

.PHONY: dev-mcp
dev-mcp:
	pnpm --filter @agent-economy-wallet/mcp-server dev

# ── Test ─────────────────────────────────────────────────────────────────────
.PHONY: test
test:
	pnpm -r test

.PHONY: test-watch
test-watch:
	pnpm --filter @agent-economy-wallet/core exec vitest

# ── Run ──────────────────────────────────────────────────────────────────────
.PHONY: start
start: build
	node $(CLI_DIST)

.PHONY: cli
cli: build-cli
	node $(CLI_DIST)

.PHONY: mcp
mcp: build-mcp
	node $(MCP_DIST)

# ── Clean ────────────────────────────────────────────────────────────────────
.PHONY: clean
clean:
	pnpm -r clean

.PHONY: clean-core
clean-core:
	pnpm --filter @agent-economy-wallet/core clean

.PHONY: clean-cli
clean-cli:
	pnpm --filter @agent-economy-wallet/cli clean

.PHONY: clean-mcp
clean-mcp:
	pnpm --filter @agent-economy-wallet/mcp-server clean

# ── Rebuild ──────────────────────────────────────────────────────────────────
.PHONY: rebuild
rebuild: clean build

# ── Docker ───────────────────────────────────────────────────────────────────
.PHONY: docker-build
docker-build:
	docker build --no-cache -t agent-economy-wallet:latest .

.PHONY: docker-up
docker-up:
	docker compose up cli

.PHONY: docker-down
docker-down:
	docker compose down

.PHONY: docker-clean
docker-clean:
	docker compose down -v
