# 🤖 Solana Agentic Wallet

> **Autonomous AI agents with secure Solana wallets** — encrypted key management, on-chain DEX swaps, policy enforcement, and a real-time monitoring dashboard.

[![Solana](https://img.shields.io/badge/Solana-Devnet-14F195?style=flat-square&logo=solana)](https://solana.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue?style=flat-square&logo=typescript)](https://typescriptlang.org)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

---

## What is this?

A complete toolkit for running autonomous AI agents on Solana. Each agent gets its own encrypted wallet, executes configurable trading strategies, and operates within safety guardrails — all observable through a CLI and web dashboard.

**Agents can:**

- 🔐 Create wallets programmatically with AES-256-GCM encrypted keys
- ✍️ Sign transactions automatically (legacy + versioned)
- 💰 Hold SOL and SPL tokens
- 🔄 Swap tokens via on-chain AMM (DevnetSwapClient on devnet, Jupiter on mainnet)
- 📊 Run strategies: DCA, Rebalance, Liquidity, Arbitrage
- 🛡️ Enforce policies: spending limits, rate limits, program allowlists
- 📝 Log every action to an immutable audit trail

## Architecture

```
┌─────────────────────────────────┐
│     AI Agent (Any Framework)     │
│  LangChain │ AutoGPT │ Custom   │
└──────────────┬──────────────────┘
               │ reads SKILL.md / imports SDK
┌──────────────▼──────────────────┐
│         Agent Engine             │
│  Orchestrator → Strategies       │
│  DCA │ Rebalance │ Arb │ LP     │
└──────────────┬──────────────────┘
┌──────────────▼──────────────────┐
│         Wallet Core              │
│  KeyManager (AES-256-GCM)       │
│  WalletService (Sign & Send)    │
│  PolicyEngine (Safety)          │
│  Jupiter (mainnet) │ DevnetSwap │ SPL │
└──────────────┬──────────────────┘
               │
┌──────────────▼──────────────────┐
│     Solana Blockchain (Devnet)   │
└─────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm 8+

### Setup

```bash
# Clone the repository
git clone https://github.com/your-username/agentic-wallet.git
cd agentic-wallet

# Install dependencies
pnpm install

# Configure environment
cp .env.example .env
# Edit .env and set WALLET_PASSPHRASE (any strong passphrase)

# Build all packages
pnpm build
```

### Run the Demo

```bash
# Full automated demo (creates wallets, funds them, runs agents)
pnpm demo

# Or step by step:
pnpm demo:create    # Create 3 agent wallets
pnpm demo:fund      # Airdrop devnet SOL
pnpm demo:run       # Run strategies for 60 seconds
pnpm demo:observe   # View results and audit logs
```

### CLI Usage

```bash
# Create a wallet
pnpm cli wallet create --label "my-agent"

# Request devnet SOL
pnpm cli wallet airdrop <walletId> --amount 2

# Check balance
pnpm cli wallet balance <walletId>

# Swap tokens via Jupiter
pnpm cli swap <walletId> \
  --from So11111111111111111111111111111111111111112 \
  --to 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU \
  --amount 100000000

# Spawn an agent
pnpm cli agent spawn \
  --name "DCA Bot" \
  --wallet <walletId> \
  --strategy dca \
  --config '{"outputMint":"4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU","amountPerSwap":50000000}'

# View status and logs
pnpm cli status
pnpm cli logs
```

### Dashboard

```bash
# Start the monitoring dashboard
pnpm dashboard:dev
# Open http://localhost:3000
```

## Project Structure

```
agentic-wallet/
├── packages/
│   ├── wallet-core/          # Core SDK: keys, signing, transactions, DeFi
│   │   └── src/
│   │       ├── key-manager.ts       # AES-256-GCM encrypted keystore
│   │       ├── wallet-service.ts    # Sign, send, balance operations
│   │       ├── policy-engine.ts     # Safety guardrails
│   │       ├── transaction-builder.ts # High-level tx construction
│   │       ├── audit-logger.ts      # JSONL audit trail
│   │       ├── connection.ts        # Solana RPC wrapper
│   │       ├── config.ts            # Configuration
│   │       └── defi/
│   │           ├── swap-client.ts    # Protocol-agnostic ISwapClient interface
│   │           ├── devnet-swap.ts    # Real on-chain AMM pool for devnet
│   │           ├── jupiter.ts       # Jupiter DEX integration (mainnet)
│   │           └── spl-token.ts     # SPL Token operations
│   │
│   ├── agent-engine/         # Multi-agent orchestration
│   │   └── src/
│   │       ├── orchestrator.ts      # Agent lifecycle management
│   │       ├── agent.ts             # Agent class with tick loop
│   │       ├── event-bus.ts         # Real-time event system
│   │       └── strategies/
│   │           ├── dca.ts           # Dollar-cost averaging
│   │           ├── rebalance.ts     # Portfolio rebalancing
│   │           ├── liquidity.ts     # LP monitoring
│   │           └── arbitrage.ts     # Price arbitrage detection
│   │
│   ├── cli/                  # Commander.js CLI tool
│   │   └── src/index.ts
│   │
│   ├── skills/               # OpenClaw-compatible SKILL.md files
│   │   ├── create-wallet/
│   │   ├── send-sol/
│   │   ├── send-spl-token/
│   │   ├── swap-tokens/
│   │   ├── check-balance/
│   │   ├── airdrop-devnet/
│   │   ├── manage-agents/
│   │   └── view-audit-logs/
│   │
│   └── dashboard/            # Next.js 14 monitoring UI
│       └── src/app/
│
├── demo/                     # Demo scripts
│   ├── 01-create-agents.ts
│   ├── 02-fund-agents.ts
│   ├── 03-run-agents.ts
│   ├── 04-observe.ts
│   └── run-demo.ts
│
├── SKILLS.md                 # Agent skills reference
├── DEEP-DIVE.md              # Architecture deep dive
└── README.md                 # This file
```

## Security

- **Encrypted Keys**: AES-256-GCM with PBKDF2 key derivation (210k iterations, SHA-512)
- **No Plaintext Keys**: Private keys never exist on disk in plaintext
- **Policy Enforcement**: Spending limits, rate limits, program allowlists checked before every tx
- **Audit Trail**: Every operation logged to JSONL files
- **Devnet Default**: All configuration defaults to Solana devnet

## Agent Skills

This project includes 8 OpenClaw-compatible skills that any AI agent framework can read and execute. See [SKILLS.md](SKILLS.md) for the full reference.

| Skill             | What it does              |
| ----------------- | ------------------------- |
| `create-wallet`   | Generate encrypted wallet |
| `send-sol`        | Transfer SOL              |
| `send-spl-token`  | Transfer SPL tokens       |
| `swap-tokens`     | On-chain AMM swap         |
| `check-balance`   | Query balances            |
| `airdrop-devnet`  | Fund on devnet            |
| `manage-agents`   | Spawn/stop agents         |
| `view-audit-logs` | Read audit trail          |

## Trading Strategies

| Strategy      | Description                                                          |
| ------------- | -------------------------------------------------------------------- |
| **DCA**       | Periodically swap a fixed amount (e.g., 0.1 SOL → USDC every minute) |
| **Rebalance** | Maintain target allocations (e.g., 60% SOL / 40% USDC)               |
| **Liquidity** | Monitor LP pool conditions and recommend entries                     |
| **Arbitrage** | Detect circular swap opportunities (SOL → Token → SOL)               |

## Technical Stack

- **Runtime**: Node.js 18+, TypeScript 5.5
- **Blockchain**: @solana/web3.js 1.95, @solana/spl-token 0.4.6
- **DEX**: DevnetSwapClient (on-chain constant-product AMM on devnet), Jupiter V6 API (mainnet)
- **Encryption**: Node.js `crypto` (AES-256-GCM, PBKDF2)
- **CLI**: Commander.js, chalk, ora
- **Dashboard**: Next.js 14, Tailwind CSS, Recharts
- **Monorepo**: pnpm workspaces
- **Testing**: Vitest

## Environment Variables

```bash
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_CLUSTER=devnet
WALLET_PASSPHRASE=your-strong-passphrase-here
JUPITER_API_URL=https://api.jup.ag/swap/v1
```

## Deep Dive

For a detailed technical walkthrough covering the security model, architecture decisions, agent engine design, and more, see [DEEP-DIVE.md](DEEP-DIVE.md).

## License

MIT
