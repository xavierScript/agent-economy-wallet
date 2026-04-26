<p align="center">
  <img src="./assets/dark.svg" alt="Yanga Wallet Logo" width="200" />
</p>

<h1 align="center">Yanga Wallet (formerly Agent Economy Wallet)</h1>

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
  <a href="https://xavierscript.mintlify.app">Documentation</a> · <a href="https://yanga-wallet.vercel.app">Explorer</a> · <a href="https://dev.to/xavier_script/from-broke-bots-to-streaming-economies-building-the-agent-economy-wallet-edb">Hackathon Article</a> · <a href="https://explorer.solana.com/tx/4QzWvrcoRYcJYh4fH1su8prLmJ1vme7ivXY2JWsDZzeXDUvR3MnaQjGKUAN2mkKgdjY157cjDQH22hTJ8pWXWmA2?cluster=devnet">Streaming TX</a>
</p>

---

## What is this?

A complete SDK and server for building an **autonomous Yanga Market** on Solana, built for the MagicBlock Hackathon. AI agents can:

- **Stream payments (Per-Compute)** — stream USDC gaslessly by the millisecond using **MagicBlock Ephemeral Rollups**
- **Buy & Sell services (Per-Request)** — gate HTTP endpoints behind x402 micropayments
- **Discover & evaluate** — find merchants via on-chain SPL Memo and check their Anchor PDA reputation

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

Paste this into Claude Desktop and watch the Yanga Market work:

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
programs/          Solana Anchor smart contracts (Reputation & ER Streaming)
kora/              Kora gasless relay configuration
docs/              Mintlify documentation site
```

---

## SDK Usage

Install and embed the Yanga Market into your own Node.js app:

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
| **Streaming via Ephemeral Rollups** | Per-compute, sub-second continuous streaming payments powered by MagicBlock ER |
| **Decentralized Registry** | On-chain merchant registration via SPL Memo — no database, no gatekeeper |
| **x402 Micropayments** | Pay-per-request USDC payments on Solana |
| **Anchor Reputation** | On-chain smart contract (PDA-based) tracking merchant volume, transactions, and unique buyers permanently |
| **Protocol Revenue** | Built-in zero-friction protocol fee (0.5% default) splitting payments automatically between merchant and protocol treasury |
| **18+ MCP Tools** | Wallet, transfers, streaming sessions, payments, discovery — all via Model Context Protocol |
| **Gasless via Kora** | Agent wallets never pay gas — Kora paymaster sponsors fees |
| **Policy Engine** | Per-transaction caps, daily limits, rate limiting, whitelist enforcement |
| **AES-256-GCM Keystore** | Private keys encrypted at rest, never exposed to the LLM |
| **[Explorer Dashboard](https://yanga-wallet.vercel.app)** | Beautiful real-time visual directory of all on-chain registered agents and live activity |

---

## Published Packages

| Package | Description |
|---------|-------------|
| [`agent-economy-wallet`](https://www.npmjs.com/package/agent-economy-wallet) | Unified SDK — start here |
| [`@agent-economy-wallet/core`](https://www.npmjs.com/package/@agent-economy-wallet/core) | Cryptographic and protocol foundation |
| [`@agent-economy-wallet/mcp-server`](https://www.npmjs.com/package/@agent-economy-wallet/mcp-server) | MCP server for AI agent integration |

---

## Submission Links & Resources

| Resource | Link |
|----------|------|
| Documentation | [xavierscript.mintlify.app](https://xavierscript.mintlify.app) |
| Explorer | [yanga-wallet.vercel.app](https://yanga-wallet.vercel.app) |
| Hackathon Article | [dev.to (Streaming Economies)](https://dev.to/xavier_script/from-broke-bots-to-streaming-economies-building-the-agent-economy-wallet-edb) |
| Settlement TX | [Solana Explorer (Devnet)](https://explorer.solana.com/tx/4QzWvrcoRYcJYh4fH1su8prLmJ1vme7ivXY2JWsDZzeXDUvR3MnaQjGKUAN2mkKgdjY157cjDQH22hTJ8pWXWmA2?cluster=devnet) |
| Demo Playlist | [YouTube](https://www.youtube.com/playlist?list=PL0SN_TTIhgAUG_kiUNZd4crZruk12ZTUk) |
| Security Policy | [SECURITY.md](./SECURITY.md) |
| License | [MIT](./LICENSE) |

---

## Contributing

Contributions are welcome. Please open an issue to discuss proposed changes before submitting a pull request. See [SECURITY.md](./SECURITY.md) for responsible disclosure guidelines.

---

## License

MIT — see [LICENSE](./LICENSE) for details.
