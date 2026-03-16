# ── Stage 1: builder ──────────────────────────────────────────────────────────
# Installs all deps and compiles every TypeScript package in the monorepo.
FROM node:22-alpine AS builder

# Enable corepack so we can use pnpm without a separate install step
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy manifests first — Docker caches this layer and only re-runs pnpm install
# when a package.json or lockfile actually changes.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.json ./
COPY packages/wallet-core/package.json  packages/wallet-core/
COPY packages/cli/package.json          packages/cli/
COPY packages/mcp-server/package.json   packages/mcp-server/

# Install all deps (dev + prod) — needed for tsc
RUN pnpm install --frozen-lockfile

# Copy source files
COPY packages/ packages/

# Build in dependency order: core → cli → mcp-server
RUN pnpm --filter @agent-economy-wallet/core build && \
    pnpm --filter @agent-economy-wallet/cli build && \
    pnpm --filter @agent-economy-wallet/mcp-server build


# ── Stage 2: runner ───────────────────────────────────────────────────────────
# Lean production image — only dist/ output and prod dependencies.
FROM node:22-alpine AS runner

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy manifests (needed for pnpm to wire workspace packages)
COPY --from=builder /app/package.json           ./
COPY --from=builder /app/pnpm-workspace.yaml    ./
COPY --from=builder /app/pnpm-lock.yaml         ./
COPY packages/wallet-core/package.json          packages/wallet-core/
COPY packages/cli/package.json                  packages/cli/
COPY packages/mcp-server/package.json           packages/mcp-server/

# Copy compiled output only
COPY --from=builder /app/packages/wallet-core/dist   packages/wallet-core/dist/
COPY --from=builder /app/packages/cli/dist           packages/cli/dist/
COPY --from=builder /app/packages/mcp-server/dist    packages/mcp-server/dist/

# Install production deps only (no devDependencies)
RUN pnpm install --frozen-lockfile --prod

# Wallet keystores, audit logs, and policy state are stored here.
# Mount a named or host volume to persist data between container restarts.
VOLUME ["/root/.agent-economy-wallet"]

# ── Sensible devnet defaults (override via .env or docker-compose env_file) ──
ENV SOLANA_RPC_URL=https://api.devnet.solana.com
ENV SOLANA_CLUSTER=devnet
ENV WALLET_PASSPHRASE=change-me-before-use
ENV LOG_LEVEL=info

# Default command: TUI (human operator view)
# Override with "node packages/mcp-server/dist/index.js" for the MCP server.
CMD ["node", "packages/cli/dist/index.js"]
