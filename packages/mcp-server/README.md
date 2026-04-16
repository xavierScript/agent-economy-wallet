# @agent-economy-wallet/mcp-server

The [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server for the Agent Economy Wallet. Exposes **18 tools**, **9 resources**, and **5 prompts** so that AI agents like Claude can autonomously hold Solana wallets, discover on-chain merchants, and pay for services — without any human writing a line of code per transaction.

## Installation

```bash
pnpm add @agent-economy-wallet/mcp-server
```

```bash
npm install @agent-economy-wallet/mcp-server
```

> **Node.js ≥ 18 required.**

---

## Environment Variables

```env
# Required
WALLET_PASSPHRASE=your-strong-passphrase-here
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_CLUSTER=devnet
OWNER_ADDRESS=YourBase58PublicKeyHere
AGENT_NAME=my-agent
AGENT_DESCRIPTION=What this agent does

# Optional — auto-fund new wallets from a master key
MASTER_WALLET_KEY_LABEL=master-funder

# Optional — gasless transactions via Kora relay
KORA_RPC_URL=http://localhost:8080
```

---

## Connecting to Claude Desktop

Add the server to your MCP client config, then restart the client:

### From npm (published package) — Recommended

```json
{
  "mcpServers": {
    "agent-economy-wallet": {
      "command": "npx",
      "args": ["-y", "@agent-economy-wallet/mcp-server"],
      "env": {
        "WALLET_PASSPHRASE": "your-strong-passphrase-here",
        "SOLANA_RPC_URL": "https://api.devnet.solana.com",
        "SOLANA_CLUSTER": "devnet",
        "OWNER_ADDRESS": "YourBase58PublicKeyHere",
        "AGENT_NAME": "my-agent"
      }
    }
  }
}
```

### From local monorepo (development)

```json
// macOS: ~/Library/Application Support/Claude/claude_desktop_config.json
// Windows: %APPDATA%\Claude\claude_desktop_config.json
{
  "mcpServers": {
    "agent-economy-wallet": {
      "command": "node",
      "args": ["/absolute/path/to/packages/mcp-server/dist/index.js"]
    }
  }
}
```

---

## Tools (18)

Tools give your AI agent the ability to **act**. Each has a typed input schema that Claude can parse and invoke autonomously.

### Wallet Management

| Tool | Input | Description |
|------|-------|-------------|
| `create_wallet` | `label: string` | Generate a new AES-256-GCM encrypted wallet |
| `list_wallets` | *(none)* | List all wallet IDs and public keys |
| `get_balance` | `wallet_id: string` | SOL + all SPL token balances |
| `get_audit_logs` | `wallet_id?: string` | Recent transaction history and policy decisions |
| `get_status` | *(none)* | Cluster, RPC, and Kora relay telemetry |
| `get_policy` | `wallet_id?: string` | Active spending policy and usage counters |

### Transfers

| Tool | Input | Description |
|------|-------|-------------|
| `send_sol` | `wallet_id, to, amount` | Policy-enforced SOL transfer |
| `send_token` | `wallet_id, mint, to, amount` | SPL token transfer with automatic ATA creation |
| `write_memo` | `wallet_id, message` | Publish an on-chain SPL Memo (used for registry) |

### Tokens

| Tool | Input | Description |
|------|-------|-------------|
| `mint_tokens` | `wallet_id, mint, amount, to?` | Mint SPL tokens (requires mint authority) |

### Payments (x402)

| Tool | Input | Description |
|------|-------|-------------|
| `probe_x402` | `url: string` | Discover x402 price without paying |
| `pay_x402_invoice` | `wallet_id, url, method?, body?` | Pay for gated endpoint and receive data |

### Merchant Services

| Tool | Input | Description |
|------|-------|-------------|
| `fetch_prices` | `tokens: string[]` | Live token prices via Jupiter aggregator |
| `analyze_token_security` | `mint_address: string` | Token security analysis (mint/freeze authority) |

### Discovery

| Tool | Input | Description |
|------|-------|-------------|
| `discover_registry` | *(none)* | Scan Solana for all registered merchants |
| `read_manifest` | `manifest_url: string` | Read a merchant's `.well-known/agent.json` |
| `check_reputation` | `reputation_url: string` | Check trust score and success rate |

> **Note:** `close_wallet` is intentionally excluded from MCP tools. Wallet closure is a destructive human-only operation restricted to the CLI.

---

## Resources (9)

Resources give your AI agent **read-only access** to the system's internal state:

| Resource URI | Description |
|---|---|
| `wallet://all` | All managed wallets and their balances |
| `wallet://{id}` | Detailed info for a specific wallet |
| `wallet://{id}/policy` | Spending policy and usage counters |
| `audit://logs` | Global transaction audit log |
| `audit://{id}/logs` | Per-wallet audit log |
| `system://status` | RPC connection and Kora relay health |
| `system://config` | Non-sensitive runtime configuration |
| `payments://x402-config` | Configured payment limits |
| `trading://strategies` | Available trading strategy definitions |

---

## Prompts (5)

Dynamic prompt templates that guide Claude through common workflows:

| Prompt | Description |
|--------|-------------|
| `wallet-setup` | Guided wallet initialization and funding |
| `daily-report` | Generate a wallet activity digest |
| `risk-assessment` | Evaluate policy violations and spending risks |
| `security-audit` | Review keystore and policy configuration |
| `x402-payment` | Walk through a full merchant discovery + payment flow |

---

## REST API (Express)

The server also exposes HTTP endpoints for direct access:

| Endpoint | Auth | Description |
|----------|------|-------------|
| `GET /.well-known/agent.json` | None | Service manifest for buyer discovery |
| `GET /reputation` | None | Success rate, tx count, uptime |
| `GET /registry` | None | All registered on-chain agents |
| `GET /api/fetch-price/:token` | x402 (0.05 USDC) | Live token price |
| `GET /api/analyze-token/:address` | x402 (0.1 USDC) | Token security analysis |

---

## License

MIT
