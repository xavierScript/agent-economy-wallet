<p align="center">
  <img src="./assets/dark.svg" alt="Agent Economy Wallet Logo" width="200" />
</p>

<h1 align="center">Agent Economy Wallet</h1>

<p align="center">
  <strong>Agent-to-Agent Marketplace SDK on Solana — discover, evaluate, and pay for services autonomously.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/agent-economy-wallet"><img src="https://img.shields.io/npm/v/agent-economy-wallet?label=npm&color=cb3837" alt="npm version" /></a>
  <a href="https://solana.com"><img src="https://img.shields.io/badge/Solana-black?logo=solana" alt="Solana" /></a>
  <a href="https://typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-blue?logo=typescript" alt="TypeScript" /></a>
  <a href="https://modelcontextprotocol.io"><img src="https://img.shields.io/badge/MCP-Protocol-green" alt="MCP" /></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/Node.js-%3E%3D18-brightgreen?logo=node.js" alt="Node.js ≥ 18" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow" alt="License: MIT" /></a>
</p>

<p align="center">
  <a href="https://xavierscript.mintlify.app">Documentation</a> · <a href="https://agent-economy-wallet-explorer.vercel.app">Explorer</a> · <a href="https://www.youtube.com/playlist?list=PL0SN_TTIhgAUG_kiUNZd4crZruk12ZTUk">Demos</a> · <a href="https://x.com/xavierScript/status/2039315867285016736?s=20">X Article</a>
</p>

---

## What is this?

A complete SDK and server for building an **autonomous agent economy** on Solana. AI agents can:

- **Sell services** — gate any HTTP endpoint behind x402 micropayments (USDC on Solana)
- **Buy services** — discover merchants, evaluate trust, and pay autonomously via MCP tools
- **Register on-chain** — join a decentralized registry (SPL Memo) with no central gatekeeper

The registry lives entirely on the blockchain. No database. No central server. If every server goes down, any buyer agent can reconstruct the full registry from a single Solana RPC call.

---

## Quick Start

```bash
git clone https://github.com/xavierScript/agent-economy-wallet.git
cd agent-economy-wallet
pnpm install && pnpm build
cp .env.example .env   # edit with your values
pnpm start
```

Minimum required environment variables:

```env
WALLET_PASSPHRASE=your-strong-passphrase-here
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_CLUSTER=devnet
OWNER_ADDRESS=YourBase58PublicKeyHere
```

> **Detailed guides:** [Merchant Setup](https://xavierscript.mintlify.app/sdk/merchant) · [Buyer Agent Setup](https://xavierscript.mintlify.app/sdk/buyer) · [Full Quickstart](https://xavierscript.mintlify.app/quickstart)

---

## The Autonomous Buyer Flow

Paste this into Claude Desktop and watch the agent economy work:

> *"Query the on-chain agent registry, pick a merchant, check their reputation, read their manifest, then buy the cheapest service they offer."*

| Step | MCP Tool | What happens |
|------|----------|-------------|
| 1 | `discover_registry` | Scans Solana for registered merchants via SPL Memo |
| 2 | `read_manifest` | Fetches `/.well-known/agent.json` from a merchant |
| 3 | `check_reputation` | Checks `/reputation` — success rate, tx count |
| 4 | `probe_x402` | Confirms price on the x402-gated endpoint |
| 5 | *(policy check)* | Wallet policy engine approves the spend |
| 6 | `pay_x402_invoice` | USDC payment → Solana tx confirmed |
| 7 | *(data returned)* | Purchased data returned to user |

**No human touched steps 1–7.**

---

## Project Structure

```
packages/
  wallet-core/     Cryptographic foundation — keys, policies, audit, protocols
  mcp-server/      MCP tools/resources/prompts + Express merchant API
  cli/             Ink-based TUI for human operators (private, not published)
  sdk/             Unified npm package (agent-economy-wallet)
  explorer/        Next.js dashboard — browse the on-chain registry
kora/              Kora gasless relay configuration
docs/              Mintlify documentation site
```

---

## SDK Usage

Install and embed the agent economy into your own Node.js app:

```bash
pnpm add agent-economy-wallet
```

```typescript
import {
  createCoreServices,
  createX402Paywall,
  discoverRegistry,
  WELL_KNOWN_TOKENS,
} from 'agent-economy-wallet';

const services = createCoreServices();

// Merchant — gate an endpoint with x402 (0.05 USDC)
app.get('/my-api', createX402Paywall(services, 50_000, WELL_KNOWN_TOKENS.USDC), handler);

// Buyer — discover merchants from the on-chain registry and pay autonomously
const conn = services.connection.getConnection();
const agents = await discoverRegistry(conn, 100);
```

> **Full SDK documentation:** [SDK Overview](https://xavierscript.mintlify.app/sdk/overview) · [Publishing Guide](https://xavierscript.mintlify.app/sdk/publishing)

---

## Key Features

| Feature | Description |
|---------|-------------|
| **Decentralized Registry** | On-chain merchant registration via SPL Memo — no database, no gatekeeper |
| **x402 Micropayments** | Pay-per-request USDC payments on Solana |
| **Protocol Revenue** | Built-in zero-friction protocol fee (0.5% default) splitting payments automatically between merchant and protocol treasury |
| **Anchor Reputation** | On-chain smart contract (PDA-based) tracking merchant volume, transactions, and unique buyers permanently |
| **18 MCP Tools** | Wallet, transfers, tokens, payments, discovery — all via Model Context Protocol |
| **9 MCP Resources** | Read-only data streams for agent context (balances, audit, policies) |
| **5 MCP Prompts** | Guided workflows (risk assessment, security audit, daily report) |
| **Gasless via Kora** | Agent wallets never pay gas — Kora paymaster sponsors fees |
| **Policy Engine** | Per-transaction caps, daily limits, rate limiting, whitelist enforcement |
| **AES-256-GCM Keystore** | Private keys encrypted at rest, never exposed to the LLM |
| **[Explorer Dashboard](https://agent-economy-wallet-explorer.vercel.app)** | Beautiful real-time visual directory of all on-chain registered agents and live activity |

---

## Published Packages

| Package | Description |
|---------|-------------|
| [`agent-economy-wallet`](https://www.npmjs.com/package/agent-economy-wallet) | Unified SDK — start here |
| [`@agent-economy-wallet/core`](https://www.npmjs.com/package/@agent-economy-wallet/core) | Cryptographic and protocol foundation |
| [`@agent-economy-wallet/mcp-server`](https://www.npmjs.com/package/@agent-economy-wallet/mcp-server) | MCP server for AI agent integration |

---

## Resources

| Resource | Link |
|----------|------|
| Documentation | [xavierscript.mintlify.app](https://xavierscript.mintlify.app) |
| Explorer | [agent-economy-wallet-explorer.vercel.app](https://agent-economy-wallet-explorer.vercel.app) |
| Demo Playlist | [YouTube](https://www.youtube.com/playlist?list=PL0SN_TTIhgAUG_kiUNZd4crZruk12ZTUk) |
| Security Policy | [SECURITY.md](./SECURITY.md) |
| License | [MIT](./LICENSE) |

---

## Contributing

Contributions are welcome. Please open an issue to discuss proposed changes before submitting a pull request. See [SECURITY.md](./SECURITY.md) for responsible disclosure guidelines.

---

## License

MIT — see [LICENSE](./LICENSE) for details.
