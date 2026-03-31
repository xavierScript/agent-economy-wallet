# @agent-economy-wallet/core

The cryptographic and on-chain protocol foundation for the [Agent Economy Wallet](https://github.com/xavierScript/agent-economy-wallet). Every other package in the ecosystem depends on this one.

> **If you just want to integrate the agent marketplace into your app, install [`agent-economy-wallet`](https://www.npmjs.com/package/agent-economy-wallet) instead — it re-exports everything from this package plus higher-level helpers.**

## Installation

```bash
pnpm add @agent-economy-wallet/core
```

```bash
npm install @agent-economy-wallet/core
```

> **Node.js ≥ 18 required.**

---

## What's Inside

| Module | Export | Description |
|--------|--------|-------------|
| **Core** | `createCoreServices()` | Factory — wires all services from environment |
| **Core** | `WalletService` | Wallet CRUD, signing, balance queries |
| **Core** | `KeyManager` | AES-256-GCM + PBKDF2 encrypted keystore |
| **Core** | `PolicyEngine` | Immutable spending guardrails for all transfers |
| **Core** | `AuditLogger` | Tamper-evident logging for every action |
| **Core** | `SolanaConnection` | Managed Solana RPC connection wrapper |
| **Protocol** | `TransactionBuilder` | Assemble and sign Solana transactions |
| **Protocol** | `SplTokenService` | Mint, transfer, and query SPL tokens |
| **Protocol** | `X402Client` | Buyer-side autonomous x402 payment client |
| **Protocol** | `X402ServerService` | Merchant-side x402 transaction verification |
| **Protocol** | `withX402Paywall` | Low-level Express middleware for x402 gating |
| **Registry** | `discoverRegistry` | Scan Solana on-chain for registered merchants |
| **Registry** | `buildRegistrationTx` | Build SPL Memo registration transaction |
| **Relay** | `KoraService` | Gasless transaction relay via Kora paymaster |
| **Relay** | `MasterFunder` | Auto-fund new agent wallets from a master key |
| **Utility** | `WELL_KNOWN_TOKENS` | Symbol → mint address map (USDC, WSOL, etc.) |
| **Utility** | `getDefaultConfig` | Read and validate env vars into `AgentWalletConfig` |

---

## Environment Variables

```env
# Required
WALLET_PASSPHRASE=your-strong-passphrase-here
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_CLUSTER=devnet
OWNER_ADDRESS=YourBase58PublicKeyHere

# Optional — auto-fund new wallets
MASTER_WALLET_SECRET_KEY=your-base58-master-key   # or use MASTER_WALLET_KEY_LABEL
MASTER_WALLET_KEY_LABEL=master-funder              # preferred (uses AES-encrypted keystore)
AGENT_SEED_SOL=0.01

# Optional — gasless transactions
KORA_RPC_URL=http://localhost:8080
```

---

## Usage

### createCoreServices()

Bootstrap every service from your environment in one line. Shared by the CLI, MCP server, and SDK:

```typescript
import { createCoreServices } from "@agent-economy-wallet/core";

const services = createCoreServices();
// services.walletService
// services.keyManager
// services.policyEngine
// services.auditLogger
// services.connection
// services.txBuilder
// services.splTokenService
// services.x402Server
// services.masterFunder  (null if not configured)
// services.koraService   (null if not configured)
```

### WalletService — Create a Wallet

```typescript
import { createCoreServices, type Policy } from "@agent-economy-wallet/core";

const { walletService } = createCoreServices();

// Signature: createWallet(label?, policy?, metadata?, autoFund?)
const wallet = await walletService.createWallet(
  "my-agent",    // label
  undefined,     // policy (see below)
  {},            // metadata
  true,          // autoFund from master wallet
);

/*
  Returns WalletInfo:
  {
    id: string;
    label: string;
    publicKey: string;
    balanceSol: number;
    balanceLamports: number;
    createdAt: string;
    metadata: Record<string, unknown>;
  }
*/
```

### PolicyEngine — Enforcing Spending Limits

Policies are attached at wallet creation (or later) and enforced on every `signAndSendTransaction` call:

```typescript
import { createCoreServices, type Policy } from "@agent-economy-wallet/core";

const { walletService, policyEngine } = createCoreServices();

const policy: Policy = {
  maxSolPerTx: 0.05,         // SOL cap per single transaction
  dailySolLimit: 0.5,         // rolling 24-hour SOL cap
  maxTxPerHour: 20,           // rate limit
  allowedPrograms: [          // on-chain program whitelist
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", // SPL Token
  ],
};

const wallet = await walletService.createWallet("safe-agent", policy);

// Or attach/update a policy after creation
policyEngine.attachPolicy(wallet.id, policy);
```

### Signing a Transaction

```typescript
const { walletService, txBuilder } = createCoreServices();
const wallet = await walletService.createWallet("signer");

// Build a SOL transfer transaction
const tx = await txBuilder.buildSolTransfer(
  wallet.publicKey,
  "RecipientBase58Address",
  0.01 * 1e9  // lamports
);

// Signature: signAndSendTransaction(walletId, tx, context?, additionalSigners?)
const result = await walletService.signAndSendTransaction(
  wallet.id,
  tx,
  { action: "sol:transfer", details: { to: "RecipientBase58Address" } }
);

/*
  Returns TransactionResult:
  {
    signature: string;      // base58 tx signature
    gasless: boolean;       // true if Kora relay was used
    network: string;        // "devnet" | "mainnet-beta"
    explorerUrl: string;    // https://explorer.solana.com/tx/...
  }
*/
```

### Registry — Discover and Register Merchants

```typescript
import {
  discoverRegistry,
  buildRegistrationTx,
  createCoreServices,
} from "@agent-economy-wallet/core";

const { walletService, connection } = createCoreServices();
const conn = connection.getConnection();

// Discover all merchants registered on-chain
// discoverRegistry(connection, limit?)
const merchants = await discoverRegistry(conn, 100);
// Each: { publicKey, manifestUrl, registeredAt, signature }

// Register your own merchant
// buildRegistrationTx(connection, publicKey, manifestUrl)
const { walletId, transaction } = await buildRegistrationTx(
  conn,
  wallet.publicKey,
  "https://my-agent.com/.well-known/agent.json"
);
const result = await walletService.signAndSendTransaction(walletId, transaction);
console.log(result.explorerUrl);
```

### x402 — Gating an Express Endpoint (Merchant)

```typescript
import express from "express";
import {
  createCoreServices,
  withX402Paywall,
  WELL_KNOWN_TOKENS,
} from "@agent-economy-wallet/core";

const app = express();
const services = createCoreServices();

// withX402Paywall(services, amountInBaseUnits, mintAddress)
// 100_000 = 0.1 USDC (6 decimals)
app.get(
  "/api/data",
  withX402Paywall(services, 100_000, WELL_KNOWN_TOKENS.USDC),
  (req, res) => res.json({ result: "Paid access only" })
);

app.listen(3000);
```

---

## Security Architecture

- **Keys never leave the encrypted keystore.** AI agents only ever see public key references. `unlockWallet()` loads the decrypted keypair into memory for a single signing operation and does not store it.
- **PBKDF2 key derivation** with 210,000 SHA-512 iterations from `WALLET_PASSPHRASE`.
- **`closeWallet()` is human-only.** It requires `{ humanInitiated: true }` — a literal type that cannot be satisfied by any MCP tool schema, making it a compile-time barrier against agent-initiated key deletion.
- **`AuditLogger`** persists every action (success or failure) out of process, so audit trails survive even if the agent crashes.

---

## License

MIT
