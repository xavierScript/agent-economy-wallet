# Merchant Quickstart

Deploy your own merchant agent and start selling services to AI agents in under 10 minutes.

---

## What you're building

A server that:
- Exposes API endpoints behind x402 paywalls (buyers pay USDC to access your data)
- Publishes a machine-readable manifest at `/.well-known/agent.json` so buyer agents know what you sell
- Exposes a `/reputation` endpoint so buyers can verify your trust score
- Registers itself on-chain so buyer agents can discover you automatically

## Prerequisites

- Node.js ≥ 18
- pnpm (`npm install -g pnpm`)
- A Solana Devnet wallet with a small amount of SOL (for the one-time on-chain registration)

---

## Step 1: Clone & Install

```bash
git clone https://github.com/xavierScript/agent-economy-wallet.git
cd agent-economy-wallet
pnpm install
```

## Step 2: Configure Environment

Copy the example `.env` and fill in your values:

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Required
WALLET_PASSPHRASE=your-strong-passphrase-here
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_CLUSTER=devnet

# Your wallet address — receives x402 payments from buyer agents
OWNER_ADDRESS=YourBase58PublicKeyHere
# Optionally set a different merchant receiver address
# MERCHANT_RECEIVER_ADDRESS=DifferentBase58PublicKey

# Master wallet — funds newly created agent wallets automatically
MASTER_WALLET_SECRET_KEY=YourBase58SecretKeyHere
AGENT_SEED_SOL=0.05
```

| Variable | What it does |
|---|---|
| `WALLET_PASSPHRASE` | Encrypts private keys at rest (AES-256-GCM) |
| `OWNER_ADDRESS` | Your public key — receives payments |
| `MASTER_WALLET_SECRET_KEY` | Funds new agent wallets (devnet only) |
| `SOLANA_RPC_URL` | Solana RPC endpoint |

## Step 3: Build & Start

```bash
pnpm build
node packages/mcp-server/dist/index.js
```

Your server is now live on port 3000 with:

| Endpoint | Auth | Description |
|---|---|---|
| `GET /.well-known/agent.json` | None | Your service manifest |
| `GET /reputation` | None | Your trust score |
| `GET /registry` | None | All registered agents (from chain) |
| `GET /api/fetch-price/:token` | x402 (0.05 USDC) | Live token prices |
| `GET /api/analyze-token/:address` | x402 (0.1 USDC) | Token security analysis |

## Step 4: Register On-Chain

Register yourself on the decentralised Solana registry so buyer agents can discover you:

```bash
pnpm register --manifest https://your-server.com/.well-known/agent.json
```

Output:
```
✅ Registered "data" on-chain
   tx: 5Yz3k...XqP
   https://solscan.io/tx/5Yz3k...XqP?cluster=devnet
```

This costs ~$0.001 and is permanent. Your registration lives on the Solana blockchain — no central server can take it down.

## Step 5: Verify

Test your endpoints:

```bash
# Manifest
curl http://localhost:3000/.well-known/agent.json

# Reputation
curl http://localhost:3000/reputation

# Price endpoint (will return 402 — that's correct, it requires payment)
curl http://localhost:3000/api/fetch-price/SOL
```

---

## How buyers find and pay you

1. A buyer agent calls `discover_registry` → finds your manifest URL on-chain
2. Buyer calls `read_manifest` → sees your services and pricing
3. Buyer calls `check_reputation` → sees your success rate
4. Buyer calls `probe_x402` on your endpoint → confirms price
5. Buyer calls `pay_x402_invoice` → sends USDC, gets data back

All of this happens autonomously — no human touches steps 1–5.

## Customising your services

Edit `packages/mcp-server/src/api/server.ts` to add new endpoints. Each endpoint needs:
1. A route handler with your business logic
2. The `x402Paywall(amount, USDC_MINT)` middleware to enforce payment
3. An entry in the manifest (the `services` array in `GET /.well-known/agent.json`)

The manifest is what buyer agents use to decide what to buy. Keep it accurate.
