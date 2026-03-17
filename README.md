# Agent Economy Wallet & Server

**The infrastructure for an autonomous Agent-to-Agent economy on Solana.** Built for the **Solana AI Hackathon: Agent Talent Show**, this repository provides a complete Hybrid Server architecture. It equips AI agents with secure, policy-enforced wallets (The Buyer) AND spins up an x402-gated HTTP server (The Merchant) so agents can trustlessly buy and sell premium data from one another.

[![Solana](https://img.shields.io/badge/Solana-black?logo=solana)](https://solana.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-blue?logo=typescript)](https://typescriptlang.org)
[![MCP](https://img.shields.io/badge/MCP-Protocol-green)](https://modelcontextprotocol.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

## The Architecture (Hybrid Server)

Instead of a closed loop, this project demonstrates true machine-to-machine commerce by running two isolated systems from a single codebase:

1. **The Merchant API (Agent B):** An Express.js server that exposes premium data endpoints (like Token Security Audits). It uses a custom **x402 Paywall Middleware** that intercepts requests, issues USDC invoices, and verifies Solana transaction signatures on-chain before releasing data.
2. **The Buyer Wallet (Agent A):** A full Model Context Protocol (MCP) server that gives your LLM a programmatic wallet. It features AES-256-GCM encrypted keystores, a Policy Engine (to prevent the AI from overspending), and a native `pay_x402` tool to autonomously clear paywalls.

## Quick Start (Docker)

The fastest way to get the dual-server environment running with zero local setup:
```bash
git clone https://github.com/xavierScript/agent_economy_wallet.git
cd agent_economy_wallet

# Create your .env — WALLET_PASSPHRASE is required
cp .env.example .env

# Build the image and launch the Merchant API + TUI
docker compose up
```

## Running the 2-Agent Demo

To see the economy in action, connect an LLM (like Claude Desktop) to the MCP server and tell it to buy data from the Merchant API.

1. Add the MCP server to your AI client's configuration (e.g., Claude Desktop `claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "agent-economy-wallet": {
      "command": "node",
      "args": ["/absolute/path/to/agent_economy_wallet/packages/mcp-server/dist/index.js"]
    }
  }
}
```

2. Restart your AI client.
3. **The Magic Prompt:** Tell your AI: *"There is an external Security Agent located at `http://localhost:3000/api/analyze-token/[INSERT_DEVNET_MINT]`. Reach out to that API. If it requires payment, use your `pay_x402` tool to pay the invoice, then fetch the data and tell me if the token is safe."*
4. Watch the AI hit the paywall, sign the Solana transaction, and retrieve the data!

## Getting Started with OpenClaw

To give your OpenClaw agent instant access to the Solana Agent Economy, run the built-in installer:
```bash
git clone https://github.com/xavierScript/agent_economy_wallet.git
cd agent_economy_wallet
bash install.sh
```

This symlinks the Agent Economy Wallet skill into `~/.openclaw/skills/`. Simply tell your OpenClaw agent: *"I need a Solana wallet"* and it will provision one, check balances, and execute transactions natively.

## Project Structure

- `packages/wallet-core/` — Core wallet logic, key management, policy engine, and x402 verification.
- `packages/mcp-server/src/api/` — The Merchant Express.js API and paywall middleware.
- `packages/mcp-server/src/tools/` — The Buyer MCP tools exposed to the LLM.
- `packages/cli/` — TUI monitoring dashboard and CLI tools.
- `packages/skills/agent-economy-wallet/` — OpenClaw capability manifests and scripts.
- `docs/` — Full Mintlify API documentation.

## Security

Private keys exist only in function scope during signing — they are never returned, logged, or persisted in memory. Policies ensure buyer agents cannot drain wallets due to hallucinations, and on-chain verification ensures merchant agents cannot be spoofed.

## License

MIT