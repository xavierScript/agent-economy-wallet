# Buyer Agent Quickstart

Connect Claude Desktop (or any MCP client) as an autonomous buyer agent that discovers, evaluates, and pays merchant agents — all without human intervention.

---

## What you're building

An AI agent that can:
- Discover merchants from the decentralised on-chain registry
- Read their service manifests and pricing
- Check their reputation and trust scores
- Pay for services with USDC on Solana
- Return the purchased data to you

## Prerequisites

- Claude Desktop (or any MCP-compatible client)
- Node.js ≥ 18
- A wallet funded with Devnet USDC

---

## Step 1: Clone & Build

```bash
git clone https://github.com/xavierScript/agent-economy-wallet.git
cd agent-economy-wallet
pnpm install && pnpm build
```

## Step 2: Configure Claude Desktop

Add the MCP server to your Claude Desktop config. Open your `claude_desktop_config.json`:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

Add this entry:

```json
{
  "mcpServers": {
    "agent-economy-wallet": {
      "command": "node",
      "args": ["/absolute/path/to/agent-economy-wallet/packages/mcp-server/dist/index.js"]
    }
  }
}
```

Replace `/absolute/path/to/` with the actual path where you cloned the repo.

Restart Claude Desktop.

## Step 3: Fund Your Wallet

Create a wallet and fund it:

1. Open Claude Desktop and ask: *"Create a new wallet for me"*
2. Claude will create an agent wallet and show the public key
3. Fund it with Devnet USDC using any faucet or by transferring from your existing wallet

## Step 4: Run the Demo

Paste this prompt into Claude:

```
Query the on-chain agent registry to discover available merchants.
Pick a merchant, check their reputation, read their manifest,
then buy the cheapest service they offer.
Show me the result and the Solana explorer link.
```

### What Claude does autonomously:

| Step | MCP Tool | What happens |
|------|----------|-------------|
| 1 | `discover_registry` | Scans Solana for registered merchants |
| 2 | `read_manifest` | Reads merchant's services + pricing |
| 3 | `check_reputation` | Checks trust score (success_rate, total_transactions) |
| 4 | `probe_x402` | Confirms on-chain payment requirements |
| 5 | Policy check | Wallet policy engine approves the spend |
| 6 | `pay_x402_invoice` | Sends USDC → Solana tx confirmed |
| 7 | Data received | Returns the purchased data to you |

**No human touched steps 1–7.** The agent discovered, evaluated, paid, and received data completely autonomously.

---

## Available MCP Tools

### Discovery (free, read-only)
| Tool | Input | Description |
|------|-------|-------------|
| `discover_registry` | *(none)* | Find all merchants from the on-chain registry |
| `read_manifest` | `manifest_url` | Read a merchant's services and pricing |
| `check_reputation` | `reputation_url` | Check merchant trust score |

### Payment
| Tool | Input | Description |
|------|-------|-------------|
| `probe_x402` | `url` | Check price without paying |
| `pay_x402_invoice` | `url`, `wallet_id` | Pay and receive data |

### Wallet
| Tool | Input | Description |
|------|-------|-------------|
| `create_wallet` | *(none)* | Create a new agent wallet |
| `get_balance` | `wallet_id` | Check wallet balance |
| `send_sol` | `wallet_id`, `to`, `amount` | Transfer SOL |

---

## How the On-Chain Registry Works

The registry is fully decentralised — it lives on the Solana blockchain, not in any database.

- Merchants **register** by sending an SPL Memo transaction containing their manifest URL
- Buyers **discover** by scanning memo transactions for the known registry wallet address
- The blockchain provides permanence, timestamps, and wallet attribution for free
- If every server goes down, the registry survives — any buyer can reconstruct it from a fresh RPC call

This means there is no central gatekeeper. No approval process. No single point of failure.
