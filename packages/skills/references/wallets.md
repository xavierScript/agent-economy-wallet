# Wallets

Create and manage agent-controlled Solana wallets with encrypted key storage.

## Create Wallet

⚠️ **Always attach a policy.** See [policies.md](policies.md).

### CLI

```bash
agentic-wallet wallet create --label "my-agent"

# Output:
# ✓ Wallet created!
#   ID:         a1b2c3d4-e5f6-7890-abcd-ef1234567890
#   Public Key: 7xKXtg2CnuE9p5dPHQc2CY8Y4M3fV...
#   Cluster:    devnet
```

### SDK

```typescript
import {
  KeyManager,
  WalletService,
  PolicyEngine,
  AuditLogger,
  SolanaConnection,
  getDefaultConfig,
} from "@agentic-wallet/core";

const config = getDefaultConfig();
const connection = new SolanaConnection(config.rpcUrl, config.cluster);
const keyManager = new KeyManager(config.keystoreDir, config.passphrase);
const policyEngine = new PolicyEngine();
const auditLogger = new AuditLogger(config.logDir);
const walletService = new WalletService(
  keyManager,
  policyEngine,
  auditLogger,
  connection,
);

// Create with safety policy
const policy = PolicyEngine.createDevnetPolicy("my-agent-policy");
const wallet = await walletService.createWallet("my-agent", policy);
// → { id, publicKey, label, balanceSol, createdAt }
```

### Response Fields

| Field             | Type   | Description                                               |
| ----------------- | ------ | --------------------------------------------------------- |
| `id`              | string | UUID — use this to reference the wallet in all operations |
| `publicKey`       | string | Solana base58 public key                                  |
| `label`           | string | Human-readable name                                       |
| `balanceSol`      | number | Current SOL balance                                       |
| `balanceLamports` | number | Current balance in lamports                               |
| `createdAt`       | string | ISO timestamp                                             |

## List Wallets

### CLI

```bash
agentic-wallet wallet list
```

Shows a table with ID, Label, Public Key, and Balance for all wallets.

### SDK

```typescript
const wallets = await walletService.listWallets();
for (const w of wallets) {
  console.log(`${w.label}: ${w.publicKey} — ${w.balanceSol} SOL`);
}
```

## Check Balance

### CLI

```bash
agentic-wallet wallet balance <walletId>

# Output:
#   Wallet: my-agent
#   Public Key: 7xKXtg2CnuE...
#   SOL: 1.500000
#
#   SPL Tokens:
#     4zMMC9srt5... → 25.5
```

### SDK

```typescript
// SOL balance
const { sol, lamports } = await walletService.getBalance(walletId);

// SPL token balances
const tokens = await walletService.getTokenBalances(walletId);
for (const t of tokens) {
  console.log(`${t.mint}: ${t.uiAmount} (${t.decimals} decimals)`);
}
```

## Fund Wallet (Devnet)

### Manual (Recommended)

Go to https://faucet.solana.com, paste the wallet's public key, select Devnet, request 2 SOL.

### CLI

```bash
agentic-wallet wallet airdrop <walletId> --amount 2
```

⚠️ The devnet faucet is rate-limited (~1 request per 15-30s, max 2 SOL per request).

### SDK

```typescript
const sig = await walletService.requestAirdrop(walletId, 2);
```

## Get Public Key

```typescript
const publicKey = walletService.getPublicKey(walletId);
// → "7xKXtg2CnuE9p5dPHQc2CY8Y4M3fV..."
```

## Key Storage Details

Each wallet is stored as an encrypted JSON file in `~/.agentic-wallet/keys/`:

```json
{
  "id": "a1b2c3d4-...",
  "label": "my-agent",
  "publicKey": "7xKXtg2C...",
  "crypto": {
    "cipher": "aes-256-gcm",
    "ciphertext": "encrypted-base64...",
    "kdf": "pbkdf2",
    "kdfparams": {
      "iterations": 210000,
      "salt": "random-hex...",
      "dklen": 32,
      "digest": "sha512"
    },
    "iv": "random-hex...",
    "authTag": "random-hex..."
  },
  "createdAt": "2025-01-15T10:30:00.000Z"
}
```

The private key is **never** stored in plaintext. It's encrypted with AES-256-GCM using a key derived from your `WALLET_PASSPHRASE` via PBKDF2 (210,000 iterations, SHA-512).
