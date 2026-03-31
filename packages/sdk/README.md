# agent-economy-wallet

The official SDK for integrating the **Agent Economy Wallet** — an open-source, decentralized agent-to-agent marketplace built on Solana. Programmatically create encrypted wallets, gate API endpoints with x402 USDC paywalls, register on-chain, and discover/pay other merchants — all from Node.js.

## Installation

```bash
pnpm add agent-economy-wallet
```

```bash
# npm
npm install agent-economy-wallet

# yarn
yarn add agent-economy-wallet
```

> **Node.js ≥ 18 required.**

---

## Environment Variables

The SDK reads from your `.env` at startup via `createCoreServices()`. Copy the example file from the monorepo and fill in your values:

```env
# Required
WALLET_PASSPHRASE=your-strong-passphrase-here
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_CLUSTER=devnet
OWNER_ADDRESS=YourBase58PublicKeyHere

# Optional — auto-funds new agent wallets from a master wallet
MASTER_WALLET_SECRET_KEY=your-base58-master-key
AGENT_SEED_SOL=0.01

# Optional — gasless transactions via Kora relay
KORA_RPC_URL=http://localhost:8080
```

---

## Quick Start

### 1. Initialize the Service Factory

`createCoreServices()` is the single entry point. Call it once at startup. It reads your environment, wires all services, and returns a `CoreServices` context:

```typescript
import { createCoreServices } from "agent-economy-wallet";

const services = createCoreServices();
// services.walletService — wallet CRUD & signing
// services.txBuilder     — construct Solana transactions
// services.splTokenService — SPL token operations
// services.x402Server    — merchant-side x402 verification
// services.koraService   — gasless relay (null if not configured)
```

### 2. Create an Agent Wallet

```typescript
import { createCoreServices } from "agent-economy-wallet";

const { walletService } = createCoreServices();

// createWallet(label?, policy?, metadata?, autoFund?)
const wallet = await walletService.createWallet(
  "buyer-agent-1",  // label — human-readable name
  undefined,        // policy — optional spending guardrails
  {},               // metadata — arbitrary key-value pairs
  true,             // autoFund — seed from master wallet if configured
);

console.log(wallet.publicKey);   // Solana base58 public key
console.log(wallet.balanceSol);  // SOL balance after auto-fund
console.log(wallet.id);          // UUID used in all subsequent calls
```

**`WalletInfo` shape:**
```typescript
interface WalletInfo {
  id: string;
  label: string;
  publicKey: string;
  balanceSol: number;
  balanceLamports: number;
  createdAt: string;
  metadata: Record<string, unknown>;
}
```

### 3. Attach a Spending Policy

Protect wallets with the built-in `PolicyEngine` before any agent can spend:

```typescript
import { createCoreServices, type Policy } from "agent-economy-wallet";

const { walletService } = createCoreServices();

const policy: Policy = {
  maxSolPerTx: 0.1,         // max SOL per single transaction
  dailySolLimit: 0.5,        // rolling 24-hour SOL cap
  maxTxPerHour: 10,          // rate limit — txs per hour
  allowedPrograms: [         // only these on-chain programs may be called
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  ],
};

const wallet = await walletService.createWallet("guarded-agent", policy);
```

---

## Developer Personas

### Merchant: Gate an Endpoint with x402

Accept USDC payments on your Express server with a single middleware. Buyers pay automatically — no API keys, no billing portal.

```typescript
import express from "express";
import {
  createCoreServices,
  createX402Paywall,
  WELL_KNOWN_TOKENS,
} from "agent-economy-wallet";

const app = express();
const services = createCoreServices();

// createX402Paywall(services, amountInBaseUnits, mintAddress)
// 50_000 = 0.05 USDC (6 decimals)
app.get(
  "/api/my-data",
  createX402Paywall(services, 50_000, WELL_KNOWN_TOKENS.USDC),
  (req, res) => {
    res.json({ result: "Premium data delivered" });
  }
);

app.listen(3000);
```

### Merchant: Register On-Chain

Let buyer agents discover you by writing your manifest URL to Solana permanently (~$0.001):

```typescript
import {
  createCoreServices,
  buildRegistrationTx,
  discoverRegistry,
} from "agent-economy-wallet";

const { walletService, connection } = createCoreServices();
const conn = connection.getConnection();

// Build registration transaction
// buildRegistrationTx(connection, walletPublicKey, manifestUrl)
const { walletId, transaction } = await buildRegistrationTx(
  conn,
  wallet.publicKey,
  "https://my-agent.com/.well-known/agent.json"
);

// Sign and broadcast
// signAndSendTransaction(walletId, transaction, context?, additionalSigners?)
const result = await walletService.signAndSendTransaction(
  wallet.id,
  transaction,
  { action: "registry:register" }
);

console.log(`Registered on-chain: ${result.explorerUrl}`);
```

**`TransactionResult` shape:**
```typescript
interface TransactionResult {
  signature: string;     // base58 tx signature
  gasless: boolean;      // true if Kora relay paid the fee
  network: string;       // "devnet" | "mainnet-beta"
  explorerUrl: string;   // https://explorer.solana.com/tx/...
}
```

### Buyer: Discover Merchants and Pay

```typescript
import {
  createCoreServices,
  discoverRegistry,
} from "agent-economy-wallet";

const { walletService, connection } = createCoreServices();
const conn = connection.getConnection();

// discoverRegistry(connection, limit?)
// Returns all merchants registered via SPL Memo
const agents = await discoverRegistry(conn, 100);

console.log("Available merchants:", agents);
// Each entry: { publicKey, manifestUrl, registeredAt, signature }

// Pay for a merchant's gated endpoint autonomously
// x402Client is pre-initialized on the wallet's services
const response = await walletService.services.x402Client.fetchWithPayment(
  "https://merchant.com/api/premium-data",
  { method: "GET" }
);
const data = await response.json();
```

**`DiscoveredAgent` shape:**
```typescript
interface DiscoveredAgent {
  publicKey: string;
  manifestUrl: string;
  registeredAt: string;  // ISO timestamp
  signature: string;     // Solana tx signature of the registration
}
```

---

## Full API Reference

| Export | Category | Signature | Description |
|--------|----------|-----------|-------------|
| `createCoreServices` | Bootstrap | `() => CoreServices` | Wire all services from environment |
| `AgentWallet` | Wallet | `WalletService` alias | Create wallets, sign txs, query balances |
| `createWallet` | Wallet | `(label?, policy?, metadata?, autoFund?) => WalletInfo` | Create an AES-encrypted agent wallet |
| `getWalletInfo` | Wallet | `(walletId: string) => WalletInfo` | Fetch wallet info + live SOL balance |
| `listWallets` | Wallet | `() => WalletInfo[]` | List all wallets with balances |
| `getBalance` | Wallet | `(walletId: string) => { sol, lamports }` | SOL balance for a wallet |
| `getTokenBalances` | Wallet | `(walletId: string) => TokenBalance[]` | All SPL token balances |
| `signAndSendTransaction` | Wallet | `(walletId, tx, context?, signers?) => TransactionResult` | Policy-enforced sign & broadcast |
| `KeyManager` | Security | Class | AES-256-GCM encrypted keystore operations |
| `PolicyEngine` | Security | Class | Spending guardrails engine |
| `AuditLogger` | Security | Class | Tamper-evident transaction logging |
| `HUMAN_ONLY` | Security | Constant | Literal type guard for human-only wallet closure |
| `TransactionBuilder` | Protocol | Class | Construct Solana transactions |
| `SplTokenService` | Protocol | Class | Mint, transfer, and query SPL tokens |
| `X402Client` | Protocol | Class | Buyer-side x402 autonomous payment client |
| `X402ServerService` | Protocol | Class | Merchant-side x402 transaction verification |
| `withX402Paywall` | Middleware | `(services, amount, mint) => Middleware` | Low-level Express x402 middleware |
| `createX402Paywall` | Middleware | `(services, amount, mint) => Middleware` | High-level Express x402 middleware |
| `discoverRegistry` | Registry | `(connection, limit?) => DiscoveredAgent[]` | Scan on-chain for registered merchants |
| `buildRegistrationTx` | Registry | `(connection, publicKey, manifestUrl) => { walletId, transaction }` | Build SPL Memo registration tx |
| `getRegistryAddress` | Registry | `() => string` | Registry coordination wallet address |
| `MasterFunder` | Relay | Class | Auto-fund agent wallets from master key |
| `KoraService` | Relay | Class | Gasless tx relay via Kora paymaster |
| `WELL_KNOWN_TOKENS` | Utility | `{ USDC: string, SOL: string, ... }` | Token symbol → mint address map |
| `SolanaConnection` | Utility | Class | Managed Solana RPC connection wrapper |

---

## Publishing New Versions

This SDK is part of a pnpm workspace. Publishing is done from the monorepo root — **not** from inside this package directory.

```bash
# 1. Authenticate with npm (one-time)
pnpm login

# 2. Build all workspace packages
pnpm build

# 3. Run tests
pnpm test

# 4. Bump the version in packages/sdk/package.json
#    (also bump any packages you changed)

# 5. Publish the entire workspace — pnpm skips private and unchanged packages
pnpm publish -r --access public --no-git-checks --otp YOUR_2FA_CODE
```

> The packages published are: `agent-economy-wallet`, `@agent-economy-wallet/core`, `@agent-economy-wallet/mcp-server`.
> The root monorepo and `@agent-economy-wallet/cli` are marked `"private"` and are never published.

---

## License

MIT
