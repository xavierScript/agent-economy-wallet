<p align="center">
  <img src="./assets/dark.svg" alt="Agent Economy Wallet Logo" width="200" />
</p>

<h1 align="center">Agent Economy Wallet</h1>

<p align="center">
  <strong>Agent-to-Agent Marketplace SDK on Solana — discover, evaluate, and pay for services autonomously.</strong>
</p>

<p align="center">
  <a href="https://solana.com"><img src="https://img.shields.io/badge/Solana-black?logo=solana" alt="Solana" /></a>
  <a href="https://typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-blue?logo=typescript" alt="TypeScript" /></a>
  <a href="https://modelcontextprotocol.io"><img src="https://img.shields.io/badge/MCP-Protocol-green" alt="MCP" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow" alt="License: MIT" /></a>
</p>

---

## What is this?

A complete SDK and server for building an **autonomous agent economy** on Solana. AI agents can:

- **Sell services** — gate any HTTP endpoint behind x402 micropayments (USDC on Solana)
- **Buy services** — discover merchants, evaluate trust, and pay autonomously via MCP tools
- **Register on-chain** — join a decentralised registry (SPL Memo on Solana) with no central gatekeeper

The registry lives entirely on the blockchain. No database. No central server. If every server goes down, any buyer agent can reconstruct the full registry from a single Solana RPC call.

## Quick Start

| I want to… | Guide |
|---|---|
| **Sell** services as a merchant | [MERCHANT_QUICKSTART.md](./MERCHANT_QUICKSTART.md) |
| **Buy** services as a buyer agent | [BUYER_QUICKSTART.md](./BUYER_QUICKSTART.md) |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Agent Economy Wallet                         │
├──────────────┬──────────────────┬──────────────┬───────────────┤
│ wallet-core  │   mcp-server     │     cli      │  SDK (root)   │
│              │                  │              │               │
│ KeyManager   │ Express API:     │ Ink TUI:     │ Unified       │
│ WalletServ.  │  /.well-known/   │  Dashboard   │ npm package   │
│ PolicyEngine │    agent.json    │  Wallets     │ re-exports    │
│ AuditLogger  │  /reputation     │  Logs        │ AgentWallet   │
│ X402Client   │  /registry       │              │ discoverReg.  │
│ X402Server   │  /api/* (x402)   │              │ x402Paywall   │
│ TransBuilder │                  │              │               │
│ Registry     │ MCP Tools:       │              │               │
│  Protocol    │  discover_reg.   │              │               │
│              │  read_manifest   │              │               │
│              │  check_reputa.   │              │               │
│              │  probe_x402      │              │               │
│              │  pay_x402        │              │               │
│              │  create_wallet   │              │               │
│              │  send_sol, etc.  │              │               │
└──────────────┴──────────────────┴──────────────┴───────────────┘
         │                                 │
         ▼                                 ▼
    ┌──────────┐                   ┌──────────────┐
    │  Solana  │                   │ SPL Memo     │
    │  Devnet  │                   │ On-Chain     │
    │  (USDC)  │                   │ Registry     │
    └──────────┘                   └──────────────┘
```

## The Autonomous Buyer Flow

When a judge (or user) pastes this prompt into Claude Desktop:

> *"Query the on-chain agent registry, pick a merchant, check their reputation, read their manifest, then buy the cheapest service they offer."*

Claude autonomously executes:

| Step | MCP Tool | What happens |
|------|----------|-------------|
| 1 | `discover_registry` | Scans Solana for registered merchants via SPL Memo |
| 2 | `read_manifest` | Fetches `/.well-known/agent.json` from a merchant |
| 3 | `check_reputation` | Checks `/reputation` — success rate, tx count |
| 4 | `probe_x402` | Confirms price on the x402-gated endpoint |
| 5 | *(policy check)* | Wallet policy engine approves the spend |
| 6 | `pay_x402_invoice` | USDC payment → Solana tx confirmed |
| 7 | *(data returned)* | Purchased data returned to user |

**No human touched steps 1–7.** Explorer link printed.

## On-Chain Registry (SPL Memo)

Every other project with a "registry" has a database somewhere. This one doesn't.

**Registration:** A merchant sends a Solana transaction with an SPL Memo containing `{"agent":"name","manifest":"url","v":1}`. Cost: ~$0.001. Permanent. On-chain.

**Discovery:** A buyer queries `getSignaturesForAddress` on the known registry wallet, parses valid memos, and verifies each manifest is still live.

**What makes this different:**
- No central gatekeeper — anyone can register
- No single point of failure — the blockchain survives
- Built-in audit trail — every registration has a wallet, timestamp, and tx signature for free
- Registration costs fractions of a cent

```bash
# Register your merchant on-chain
pnpm register --manifest https://your-server.com/.well-known/agent.json
```

## 🛠 Two Ways to Use This Repository

This repository serves two distinct purposes depending on what you are trying to build.

### 1. The Reference Merchant Server (`packages/mcp-server`)
If you want to quickly spin up a standalone "Agent Data Node", you can clone this repository, run it as-is, and add your own monetised routes directly inside `mcp-server/src/api/routes/services/`. This server comes entirely pre-configured to handle `.well-known/agent.json` manifests, reputation dashboards, and X402 payment webhooks.
*(See: [MERCHANT_QUICKSTART.md](./MERCHANT_QUICKSTART.md))*

### 2. The SDK Library (`packages/sdk`)
If you **already have an existing Node.js application**, you don't need to clone this repository. You can simply install the core capabilities as a drop-in SDK:

```bash
npm install agent-economy-wallet
```

The SDK allows you to embed the agent economy *into your own app*. You can:
- Import `createX402Paywall` to easily slap Solana micropayments onto your *own* existing Express routes.
- Import `X402Client` to give your existing AI agent the ability to autonomously buy data.
- Import `buildRegistrationTx` to register your agent on the Solana blockchain.
*(See: [SDK README](./packages/sdk/README.md))*

---

## SDK Developer Personas

### 1. Merchant — monetise a skill or data source

```typescript
import { createX402Paywall, createCoreServices } from 'agent-economy-wallet';

const services = createCoreServices();
app.get('/my-api', createX402Paywall(services, 50_000, USDC_MINT), handler);
```

### 2. Buyer Agent — consume paid services autonomously

```typescript
import { AgentWallet, discoverRegistry, X402Client } from 'agent-economy-wallet';
```

### 3. Hybrid — sell one service, buy others

A code review agent that pays a data scraping agent for context. This is the network effect case — only possible because the SDK makes both sides trivial.

## Project Structure

```
packages/
  wallet-core/     Core wallet, keys, policies, x402, registry protocol
  mcp-server/      Express API + MCP tools for Claude Desktop
    src/api/         Manifest, reputation, registry, x402-gated endpoints
    src/tools/       All MCP tools (wallet, payments, discovery)
    src/scripts/     CLI scripts (register)
  cli/             Ink-based TUI monitoring dashboard
```

## API Endpoints

| Endpoint | Auth | Description |
|---|---|---|
| `GET /.well-known/agent.json` | None | Machine-readable service manifest |
| `GET /reputation` | None | Trust signals from audit log |
| `GET /registry` | None | All registered agents (from chain) |
| `GET /api/fetch-price/:token` | x402 | Live token prices |
| `GET /api/analyze-token/:address` | x402 | Token security analysis |

## MCP Tools

| Tool | Category | Description |
|------|----------|-------------|
| `discover_registry` | Discovery | Find merchants from on-chain registry |
| `read_manifest` | Discovery | Read a merchant's services & pricing |
| `check_reputation` | Discovery | Check merchant trust score |
| `probe_x402` | Payment | Check price without paying |
| `pay_x402_invoice` | Payment | Pay and receive data |
| `create_wallet` | Wallet | Create agent wallet |
| `get_balance` | Wallet | Check wallet balance |
| `send_sol` | Transfer | Transfer SOL |
| `send_token` | Transfer | Transfer SPL tokens |
| `write_memo` | Transfer | Write on-chain memo |

## 📺 Demos & Resources

- **Demo Playlist:** [Watch the Agent Economy in action on YouTube](https://www.youtube.com/playlist?list=PL0SN_TTIhgAUG_kiUNZd4crZruk12ZTUk)
- **Full Documentation:** [Read the Setup Guide](https://xavierscript.mintlify.app)

## 📄 License

MIT
