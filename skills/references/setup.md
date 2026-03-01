# Setup

Get the Agentic Wallet SDK running so agents can create wallets and execute transactions.

## 1. Prerequisites

- **Node.js 18+** — `node -v`
- **pnpm 8+** — `npm install -g pnpm`

## 2. Install

```bash
git clone https://github.com/your-username/agentic-wallet.git
cd agentic-wallet
pnpm install
```

## 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:

```dotenv
# REQUIRED — encrypts/decrypts all private keys
WALLET_PASSPHRASE=your-strong-passphrase-at-least-12-chars

# Solana network (devnet is default and recommended for testing)
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_CLUSTER=devnet

# Optional — auto-fund new agent wallets from your master wallet
MASTER_WALLET_SECRET_KEY=your-base58-secret-key
AGENT_SEED_SOL=0.05

# Optional — logging verbosity
LOG_LEVEL=info
```

### Environment Variables

| Variable                   | Required | Default                         | Description                             |
| -------------------------- | -------- | ------------------------------- | --------------------------------------- |
| `WALLET_PASSPHRASE`        | **Yes**  | dev-only fallback               | Encrypts private keys with AES-256-GCM  |
| `SOLANA_RPC_URL`           | No       | `https://api.devnet.solana.com` | Solana JSON-RPC endpoint                |
| `SOLANA_CLUSTER`           | No       | `devnet`                        | `devnet` \| `testnet` \| `mainnet-beta` |
| `LOG_LEVEL`                | No       | `info`                          | `debug` \| `info` \| `warn` \| `error`  |
| `MASTER_WALLET_SECRET_KEY` | No       | —                               | Base58 secret key for auto-funding      |
| `AGENT_SEED_SOL`           | No       | `0.05`                          | SOL to seed each new agent wallet       |

## 4. Build

```bash
pnpm build
```

This compiles all packages in order: `wallet-core` → `cli` → `mcp-server`.

## 5. Verify Setup

```bash
# Run the TUI dashboard (Ink-based terminal UI)
pnpm cli

# Or check the MCP server starts cleanly
node packages/mcp-server/dist/index.js
# (exits immediately without a client — that's expected)
```

## 6. Fund on Devnet

### Auto-funding from Master Wallet (Recommended)

Set `MASTER_WALLET_SECRET_KEY` in your `.env` to the base58-encoded secret key
of your funding wallet. New agent wallets will be **automatically funded** on
creation — no airdrop needed, no rate limits.

```dotenv
# Base58-encoded secret key of your master/funding wallet
MASTER_WALLET_SECRET_KEY=your-base58-secret-key

# Amount of SOL to seed each new wallet (default: 0.05)
AGENT_SEED_SOL=0.05
```

> **Security**: For devnet/testnet only. On mainnet, use a dedicated treasury
> wallet with its own spending limits rather than your primary wallet.

### Manual Fallback

If `MASTER_WALLET_SECRET_KEY` is not set, you can fund wallets manually
via https://faucet.solana.com (devnet only).

## 7. Connect MCP Server to an AI Agent

The MCP server exposes all 14 wallet tools via the Model Context Protocol (stdio transport).

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "agentic-wallet": {
      "command": "node",
      "args": [
        "C:\\Users\\HP\\web3-projects\\agentic-wallet\\packages\\mcp-server\\dist\\index.js"
      ],
      "env": {
        "WALLET_PASSPHRASE": "your-strong-passphrase (12 char long)",
        "SOLANA_CLUSTER": "devnet",
        "SOLANA_RPC_URL": "https://api.devnet.solana.com",
        "OWNER_ADDRESS": "55czFRi1njMSE7eJyDLx1R5yS1Bi5GiL2Ek4F1cZPLFx",
        "MASTER_WALLET_SECRET_KEY": ,
        "AGENT_SEED_SOL": 0.05
      }
    }
  }
}
```

### VS Code (Copilot Agent Mode)

Add to your workspace `.vscode/mcp.json`:

```json
{
  "servers": {
    "agentic-wallet": {
      "type": "stdio",
      "command": "node",
      "args": ["packages/mcp-server/dist/index.js"],
      "env": {
        "WALLET_PASSPHRASE": "your-passphrase",
        "SOLANA_CLUSTER": "devnet"
      }
    }
  }
}
```

### Available MCP Tools (14 total)

| Tool                | Description                              |
| ------------------- | ---------------------------------------- |
| `create_wallet`     | Create wallet with encrypted key storage |
| `list_wallets`      | List all wallets with balances           |
| `get_balance`       | SOL + SPL token balances                 |
| `send_sol`          | SOL transfer with policy enforcement     |
| `send_token`        | SPL token transfer                       |
| `swap_tokens`       | Jupiter DEX swap                         |
| `write_memo`        | Write on-chain memo (SPL Memo Program)   |
| `create_token_mint` | Create new SPL token mint                |
| `mint_tokens`       | Mint tokens to a wallet                  |
| `get_audit_logs`    | Read audit trail                         |
| `get_status`        | System status                            |
| `get_policy`        | Wallet policy + tx stats                 |
| `pay_x402`          | Pay for x402-protected HTTP resources    |
| `probe_x402`        | Check x402 pricing before paying         |

## Data Storage

All data is stored locally:

```
~/.agentic-wallet/
├── keys/           # AES-256-GCM encrypted keystores (JSON files)
├── logs/           # Audit logs (JSONL, one file per day)
└── policies/       # Policy state (JSON)
```

## OpenClaw Setup

Add credentials to `~/.openclaw/openclaw.json`:

```json
{
  "env": {
    "vars": {
      "WALLET_PASSPHRASE": "your-strong-passphrase",
      "SOLANA_CLUSTER": "devnet",
      "SOLANA_RPC_URL": "https://api.devnet.solana.com"
    }
  }
}
```

Then restart the gateway:

```bash
openclaw gateway restart
```
