# DEEP-DIVE.md — Architecture & Technical Deep Dive

## Overview

The Solana Agentic Wallet is a TypeScript monorepo that gives AI agents autonomous control of Solana wallets with encrypted key management, policy enforcement, DeFi integrations, and a monitoring dashboard.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Security Model](#security-model)
3. [Wallet Core](#wallet-core)
4. [Agent Engine](#agent-engine)
5. [DeFi Integrations](#defi-integrations)
6. [Policy Engine](#policy-engine)
7. [Skills System](#skills-system)
8. [Dashboard](#dashboard)
9. [Design Decisions](#design-decisions)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    AI Agent Layer                         │
│  LangChain │ AutoGPT │ Custom │ OpenClaw │ Any Framework │
└─────────────────┬───────────────────────────────────────┘
                  │ reads SKILL.md / imports SDK
┌─────────────────▼───────────────────────────────────────┐
│                   CLI Layer                               │
│  Commander.js CLI: `agentic-wallet <command>`            │
└─────────────────┬───────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────┐
│                 Agent Engine                              │
│  AgentOrchestrator → Agent → IAgentStrategy              │
│  ┌──────┐ ┌──────────┐ ┌───────────┐ ┌─────────┐       │
│  │ DCA  │ │Rebalance │ │ Liquidity │ │Arbitrage│       │
│  └──────┘ └──────────┘ └───────────┘ └─────────┘       │
│                    EventBus (real-time)                   │
└─────────────────┬───────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────┐
│                  Wallet Core                              │
│  ┌──────────────┐ ┌──────────────┐ ┌───────────────┐   │
│  │ KeyManager   │ │WalletService │ │ PolicyEngine  │   │
│  │ AES-256-GCM  │ │ Sign & Send  │ │ Rate Limits   │   │
│  │ PBKDF2       │ │ Balance      │ │ Spend Caps    │   │
│  └──────────────┘ └──────────────┘ └───────────────┘   │
│  ┌──────────────┐ ┌──────────────┐ ┌───────────────┐   │
│  │  TxBuilder   │ │ ISwapClient  │ │SplTokenService│   │
│  │ SOL/SPL txns │ │ AMM / Jupiter│ │ Token Ops     │   │
│  └──────────────┘ └──────────────┘ └───────────────┘   │
│  ┌──────────────┐ ┌──────────────┐                      │
│  │ AuditLogger  │ │  Connection  │                      │
│  │ JSONL Trail  │ │  Solana RPC  │                      │
│  └──────────────┘ └──────────────┘                      │
└─────────────────┬───────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────┐
│              Solana Blockchain (Devnet)                   │
│  System Program │ Token Program │ DevnetAMM │ Jupiter     │
└─────────────────────────────────────────────────────────┘
```

## Security Model

### Key Encryption (AES-256-GCM + PBKDF2)

The security design ensures private keys **never exist in plaintext on disk**:

1. **Key Generation**: `Keypair.generate()` creates an Ed25519 keypair
2. **Salt Generation**: 32 random bytes per keystore
3. **Key Derivation**: PBKDF2 with 210,000 iterations, SHA-512
4. **Encryption**: AES-256-GCM with random 16-byte IV
5. **Storage**: JSON keystore with ciphertext + salt + IV + authTag
6. **Decryption**: Only in memory, only when signing

```
Passphrase (env var)
    │
    ├─ PBKDF2 (210k iterations, SHA-512, 32-byte salt)
    │    │
    │    └─ 256-bit encryption key
    │         │
    │         ├─ AES-256-GCM encrypt (16-byte IV)
    │         │    │
    │         │    └─ Ciphertext + AuthTag → ~/.agentic-wallet/keys/{id}.json
    │         │
    │         └─ AES-256-GCM decrypt (when signing)
    │              │
    │              └─ Solana Keypair (memory only, ephemeral)
    │
    └─ Passphrase is NOT stored anywhere
```

### Keystore Format

```json
{
  "id": "uuid",
  "label": "agent-name",
  "publicKey": "base58...",
  "crypto": {
    "cipher": "aes-256-gcm",
    "ciphertext": "hex...",
    "kdf": "pbkdf2",
    "kdfparams": {
      "iterations": 210000,
      "salt": "hex...",
      "dklen": 32,
      "digest": "sha512"
    },
    "iv": "hex...",
    "authTag": "hex..."
  },
  "createdAt": "ISO8601",
  "metadata": {}
}
```

### Threat Model

| Threat                    | Mitigation                                                   |
| ------------------------- | ------------------------------------------------------------ |
| Key theft from disk       | AES-256-GCM encryption; no plaintext keys on disk            |
| Brute-force passphrase    | PBKDF2 210k iterations makes brute-force expensive           |
| Memory dump               | Keys only in memory during signing, then garbage collected   |
| Unauthorized transactions | PolicyEngine enforces limits before any signing              |
| Replay attacks            | Solana's recent blockhash provides natural replay protection |
| Runaway agents            | Rate limits, spend caps, program allowlists                  |

## Wallet Core

### KeyManager

- Generates Ed25519 keypairs via `@solana/web3.js`
- Encrypts private keys with AES-256-GCM
- Stores encrypted keystores as JSON files
- Supports import from base58 secret keys
- Lists, loads, and deletes keystores

### WalletService

- High-level API for all wallet operations
- Signs legacy and versioned transactions
- Queries SOL and SPL token balances
- Enforces policies before signing
- Logs every operation via AuditLogger

### TransactionBuilder

- Constructs SOL transfers, SPL token transfers
- Handles compute budget (priority fees)
- Auto-creates Associated Token Accounts

## Agent Engine

### Architecture

```
AgentOrchestrator
  ├── manages lifecycle of N agents
  ├── provides strategy registry
  └── exposes EventBus for subscribers

Agent
  ├── owns a wallet (by ID)
  ├── executes a strategy on tick intervals
  ├── states: idle → running → paused → stopped
  └── maintains execution log (last 100 results)

IAgentStrategy (interface)
  ├── execute(context) → StrategyResult
  ├── setup?(context) → void
  └── teardown?(context) → void
```

### Strategies

| Strategy      | Description           | Key Logic                                             |
| ------------- | --------------------- | ----------------------------------------------------- |
| **DCA**       | Dollar-cost averaging | Periodically swaps fixed amounts via ISwapClient      |
| **Rebalance** | Portfolio rebalancing | Checks allocations, rebalances when drift > threshold |
| **Liquidity** | LP monitoring         | Analyzes pool conditions and recommends entries       |
| **Arbitrage** | Price arbitrage       | Compares SOL→Token→SOL circular routes for profit     |

### Event System

The EventBus (eventemitter3) provides real-time events:

- `agent:spawned` — new agent created
- `agent:started` — agent execution loop started
- `agent:tick` — each strategy execution with result
- `agent:paused` / `agent:resumed`
- `agent:stopped` — agent lifecycle ended
- `agent:error` — strategy execution error

## DeFi Integrations

### Protocol-Agnostic Swap (ISwapClient)

The SDK uses a protocol-agnostic `ISwapClient` interface. On devnet, `DevnetSwapClient` provides a real on-chain constant-product AMM pool. On mainnet, `JupiterClient` routes through the Jupiter DEX aggregator.

```typescript
// ISwapClient interface — implemented by both DevnetSwapClient and JupiterClient
interface ISwapClient {
  getQuote(params): Promise<SwapQuote>;
  getSwapTransaction(params): Promise<VersionedTransaction>;
  buildSwap(
    params,
  ): Promise<{ quote: SwapQuote; transaction: VersionedTransaction }>;
  getPrice(inputMint, outputMint): Promise<number>;
}

// Devnet: Real on-chain AMM pool
const swapClient = new DevnetSwapClient(connection);
await swapClient.loadOrSetup(); // Creates pool authority + test-USDC mint

const quote = await swapClient.getQuote({
  inputMint: SOL,
  outputMint: swapClient.getTestMint(),
  amount: 100_000_000, // 0.1 SOL in lamports
  slippageBps: 50,
});

const tx = await swapClient.getSwapTransaction({
  quoteResponse: quote,
  userPublicKey: publicKey,
});

// Sign and send — real on-chain transaction
const sig = await walletService.signAndSendVersionedTransaction(walletId, tx);
```

#### DevnetSwapClient Internals

- **Pool Authority**: A Keypair that acts as the AMM pool, holding reserves of SOL and test-USDC
- **Constant-Product Formula**: `outputAmount = (reserveOut * inputAmount) / (reserveIn + inputAmount)`
- **Real Transactions**: SOL transfers + SPL token transfers signed on-chain
- **Persistent State**: Pool state saved to `~/.agentic-wallet/devnet-pool/pool-state.json`
- **Test-USDC**: A custom SPL token minted by the pool authority for demo purposes

### SPL Token Service

- Query token accounts and balances
- Create Associated Token Accounts
- Get mint info (decimals, supply, authority)
- Works with Token Program and Associated Token Account Program

## Policy Engine

Policies are the safety layer between agents and the blockchain:

```typescript
const policy = PolicyEngine.createDevnetPolicy();
// Enforces:
// - Max 2 SOL per transaction
// - Max 30 tx/hour, 200 tx/day
// - 2-second cooldown between transactions
// - Max 10 SOL daily spend
// - Only allowed programs (System, Token, ATA, Jupiter, ComputeBudget)
```

Policies are checked **synchronously before every transaction is signed**. Any violation immediately rejects the transaction and logs the attempt.

## Skills System

Skills follow the OpenClaw AgentSkills format — each is a markdown file with YAML frontmatter that any AI agent can read and execute:

```
packages/skills/
├── create-wallet/SKILL.md
├── send-sol/SKILL.md
├── send-spl-token/SKILL.md
├── swap-tokens/SKILL.md
├── check-balance/SKILL.md
├── airdrop-devnet/SKILL.md
├── manage-agents/SKILL.md
└── view-audit-logs/SKILL.md
```

Each skill includes:

- YAML frontmatter (name, description, allowed-tools)
- When to use guidance
- CLI command syntax
- TypeScript SDK examples
- Relevant notes and caveats

## Dashboard

Next.js 14 (App Router) with Tailwind CSS:

- Real-time system overview
- Wallet balance cards
- Agent status monitoring
- Transaction activity feed
- Dark theme with Solana branding

## Design Decisions

### Why custom wallet instead of Privy/Turnkey?

- Full control over key management security
- No vendor lock-in or API dependencies
- Demonstrates deeper Solana understanding for the bounty
- Offline-capable (no external auth service needed)

### Why PBKDF2 instead of Argon2?

- Native Node.js `crypto` module support (no native dependencies)
- 210,000 iterations provides strong brute-force resistance
- Cross-platform compatibility without compilation

### Why protocol-agnostic ISwapClient?

- **Devnet support**: Jupiter is mainnet-only; DevnetSwapClient provides real on-chain swaps on devnet
- **Testability**: Swap implementations can be swapped without changing strategy code
- **Extensibility**: Easy to add Raydium, Orca, or any other DEX
- **Consistent interface**: All strategies use the same `getQuote()`, `getSwapTransaction()`, `buildSwap()` APIs

### Why EventBus (eventemitter3) instead of WebSocket?

- Simpler in-process architecture
- Dashboard can connect via API routes
- Easy to add WebSocket bridge layer if needed
- Lower latency for agent → dashboard communication

### Why pnpm workspaces?

- Strict dependency isolation (no phantom deps)
- Efficient disk usage via content-addressable storage
- Native workspace protocol (`workspace:*`)
- Fast install times
