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

# Optional — Jupiter API for mainnet swaps
JUPITER_API_URL=https://api.jup.ag/swap/v1

# Optional — logging verbosity
LOG_LEVEL=info
```

### Environment Variables

| Variable            | Required | Default                         | Description                             |
| ------------------- | -------- | ------------------------------- | --------------------------------------- |
| `WALLET_PASSPHRASE` | **Yes**  | dev-only fallback               | Encrypts private keys with AES-256-GCM  |
| `SOLANA_RPC_URL`    | No       | `https://api.devnet.solana.com` | Solana JSON-RPC endpoint                |
| `SOLANA_CLUSTER`    | No       | `devnet`                        | `devnet` \| `testnet` \| `mainnet-beta` |
| `JUPITER_API_URL`   | No       | `https://api.jup.ag/swap/v1`    | Jupiter DEX API (mainnet only)          |
| `LOG_LEVEL`         | No       | `info`                          | `debug` \| `info` \| `warn` \| `error`  |

## 4. Build

```bash
pnpm build
```

This compiles: `wallet-core` → `agent-engine` → `cli` (in order).

## 5. Verify Setup

```bash
# Create a test wallet
pnpm cli wallet create --label "test-wallet"

# Should output:
# ✓ Wallet created!
#   ID:         a1b2c3d4-...
#   Public Key: 7xKXtg2C...
#   Cluster:    devnet

# List wallets
pnpm cli wallet list
```

## 6. Fund on Devnet

Go to https://faucet.solana.com, paste the wallet's public key, and request SOL.

Or via CLI (rate-limited):

```bash
pnpm cli wallet airdrop <walletId> --amount 2
```

## 7. Dashboard (Optional)

```bash
pnpm dashboard:dev
# Open http://localhost:3000
```

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
