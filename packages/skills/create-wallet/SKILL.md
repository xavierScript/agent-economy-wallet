---
name: create-wallet
description: Create a new Solana agent wallet with encrypted key storage and optional safety policy
---

# Create Wallet

Create a new Solana wallet for an AI agent. The private key is encrypted with AES-256-GCM and stored locally. A devnet safety policy is attached by default.

## When to Use

- Starting a new agent that needs its own wallet
- Setting up a treasury or operational wallet
- Creating isolated wallets for different strategies

## Command

```bash
agentic-wallet wallet create --label <wallet-name> --policy
```

## Parameters

| Parameter  | Type    | Required | Default        | Description                                           |
| ---------- | ------- | -------- | -------------- | ----------------------------------------------------- |
| `--label`  | string  | No       | `agent-wallet` | Human-readable name for the wallet                    |
| `--policy` | boolean | No       | `true`         | Attach devnet safety policy (rate limits, spend caps) |

## Example

```bash
# Create a DCA agent wallet
agentic-wallet wallet create --label "dca-agent"

# Output:
# ✓ Wallet created!
#   ID:         a1b2c3d4-...
#   Public Key: 7xKXtg2C...
#   Cluster:    devnet
```

## Programmatic Usage

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

const policy = PolicyEngine.createDevnetPolicy();
const wallet = await walletService.createWallet("my-agent", policy);
console.log(wallet.publicKey);
```

## Security Notes

- Private keys are encrypted with AES-256-GCM at rest
- PBKDF2 (210,000 iterations, SHA-512) derives the encryption key
- Keys are stored in `~/.agentic-wallet/keys/`
- The passphrase is read from `WALLET_PASSPHRASE` environment variable
- Keys only exist in plaintext in memory during signing operations
