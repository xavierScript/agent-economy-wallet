# Agent Economy Wallet & Server

**The infrastructure for an autonomous Agent-to-Agent economy on Solana.** This repository provides a complete Hybrid Server architecture. It equips AI agents with secure, policy-enforced wallets (The Buyer) AND spins up an x402-gated HTTP server (The Merchant) so agents can trustlessly buy and sell premium data from one another.

[![Solana](https://img.shields.io/badge/Solana-black?logo=solana)](https://solana.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-blue?logo=typescript)](https://typescriptlang.org)
[![MCP](https://img.shields.io/badge/MCP-Protocol-green)](https://modelcontextprotocol.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

## Quick Start (Docker)

The fastest way to get the dual-server environment running with zero local setup:

```bash
git clone https://github.com/xavierScript/agent_economy_wallet.git
cd agent_economy_wallet

# Create your .env
# Important: See .env.guide.md for detailed explanations of all variables
# WALLET_PASSPHRASE is required
cp .env.example .env

# Build the app
pnpm build

# Start the TUI
pnpm start
```

## Running the Agent

To see the agent in action, connect an LLM (like Claude Desktop) to the MCP server.

1. Add the MCP server to your AI client's configuration (e.g., Claude Desktop `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "agent-economy-wallet": {
      "command": "node",
      "args": [
        "/absolute/path/to/agent_economy_wallet/packages/mcp-server/dist/index.js"
      ]
    }
  }
}
```

2. Restart your AI client.
3. Tell your AI: _"Create a wallet for yourself"_
4. Watch the AI create its wallet.

## Getting Started with OpenClaw

To give your OpenClaw agent instant access to the Solana Agent Economy, run the built-in installer:

```bash
git clone https://github.com/xavierScript/agent_economy_wallet.git
cd agent_economy_wallet
bash install.sh
```

This symlinks the Agent Economy Wallet skill into `~/.openclaw/skills/`. Simply tell your OpenClaw agent: _"I need a Solana wallet"_ and it will provision one, check balances, and execute transactions natively.

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
