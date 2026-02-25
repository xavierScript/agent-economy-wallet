# 🤖 Solana Agentic Wallet

> **Autonomous AI agents with secure Solana wallets** — encrypted key management, transaction signing, and policy enforcement.

[![Solana](https://img.shields.io/badge/Solana-Devnet-14F195?style=flat-square&logo=solana)](https://solana.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue?style=flat-square&logo=typescript)](https://typescriptlang.org)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

---

## What is this?

A complete toolkit for running autonomous AI agents on Solana. Each agent gets its own encrypted wallet and operates within safety guardrails — all observable through the CLI.

**Agents can:**

- 🔐 Create wallets programmatically with AES-256-GCM encrypted keys
- ✍️ Sign transactions automatically (legacy + versioned)
- 💰 Hold SOL and SPL tokens
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
│         Wallet Core              │
│  KeyManager (AES-256-GCM)       │
│  WalletService (Sign & Send)    │
│  PolicyEngine (Safety)          │
│  TransactionBuilder │ SPL       │
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

### CLI Usage

```bash
# Create a wallet
pnpm cli wallet create --label "my-agent"

# Check balance
pnpm cli wallet balance <walletId>

# Send SOL
pnpm cli send sol <walletId> <recipientAddress> 0.5

# View status and logs
pnpm cli status
pnpm cli logs
```

## Project Structure

```
agentic-wallet/
├── packages/
│   ├── wallet-core/          # Core SDK: keys, signing, transactions
│   │   └── src/
│   │       ├── key-manager.ts       # AES-256-GCM encrypted keystore
│   │       ├── wallet-service.ts    # Sign, send, balance operations
│   │       ├── policy-engine.ts     # Safety guardrails
│   │       ├── transaction-builder.ts # High-level tx construction
│   │       ├── spl-token.ts         # SPL Token operations
│   │       ├── audit-logger.ts      # JSONL audit trail
│   │       ├── connection.ts        # Solana RPC wrapper
│   │       └── config.ts            # Configuration
│   │
│   ├── cli/                  # Commander.js CLI tool
│   │   └── src/index.ts
│   │
│   ├── skills/               # OpenClaw-compatible SKILL.md files
│   │   ├── SKILL.md
│   │   └── references/
│   │
├── examples/                 # SDK usage examples
│   └── direct-sdk.ts
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

## Skills

See [SKILLS.md](SKILLS.md) for the full agent skills reference.

| Skill             | What it does              |
| ----------------- | ------------------------- |
| `create-wallet`   | Generate encrypted wallet |
| `send-sol`        | Transfer SOL              |
| `send-spl-token`  | Transfer SPL tokens       |
| `check-balance`   | Query balances            |
| `view-audit-logs` | Read audit trail          |

## Technical Stack

- **Runtime**: Node.js 18+, TypeScript 5.5
- **Blockchain**: @solana/web3.js 1.95, @solana/spl-token 0.4.6
- **Encryption**: Node.js `crypto` (AES-256-GCM, PBKDF2)
- **CLI**: Commander.js, chalk, ora
- **Monorepo**: pnpm workspaces
- **Testing**: Vitest

## Environment Variables

```bash
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_CLUSTER=devnet
WALLET_PASSPHRASE=your-strong-passphrase-here
```

## Deep Dive

For a detailed technical walkthrough covering the security model and architecture decisions, see [DEEP-DIVE.md](DEEP-DIVE.md).

## License

MIT
