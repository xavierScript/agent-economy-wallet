# Security Reference

> How the Solana Agentic Wallet protects private keys, enforces policies, and prevents agent misuse.

---

## Key Storage — AES-256-GCM

Every wallet's private key is encrypted at rest. The system never stores plaintext keys on disk.

### Encryption Details

| Property       | Value                                   |
| -------------- | --------------------------------------- |
| Cipher         | AES-256-GCM (authenticated encryption)  |
| Key derivation | PBKDF2-HMAC-SHA512                      |
| Iterations     | 210,000 (OWASP minimum)                 |
| Salt           | 32 bytes, random, unique per keystore   |
| IV             | 16 bytes, random, unique per encryption |
| Auth tag       | 16 bytes (GCM integrity check)          |
| Key length     | 256 bits (32 bytes)                     |

### Keystore File Format

Each wallet is stored as `~/.agentic-wallet/keys/<uuid>.json`:

```json
{
  "id": "uuid",
  "label": "agent-wallet",
  "publicKey": "base58...",
  "crypto": {
    "cipher": "aes-256-gcm",
    "ciphertext": "hex-encoded encrypted 64-byte Ed25519 key",
    "iv": "hex-encoded 16-byte IV",
    "authTag": "hex-encoded 16-byte GCM tag",
    "kdf": "pbkdf2",
    "kdfparams": {
      "iterations": 210000,
      "salt": "hex-encoded 32-byte salt",
      "dklen": 32,
      "digest": "sha512"
    }
  },
  "createdAt": "ISO 8601",
  "metadata": {}
}
```

### Key Lifecycle

1. **Creation:** `crypto.randomBytes()` generates the Ed25519 seed → encrypted immediately → never held in plaintext variable longer than necessary
2. **At rest:** Only the encrypted ciphertext, salt, IV, and auth tag are on disk
3. **Signing:** Passphrase + salt → PBKDF2 → AES key → decrypt → sign transaction → key reference dropped
4. **No export:** No tool, resource, or prompt exposes the private key or passphrase

---

## Policy Engine

The PolicyEngine is the first line of defense. Every transaction is checked **before signing**.

### Default Devnet Policy

Applied automatically to every new wallet:

| Rule                    | Value                   | Purpose                          |
| ----------------------- | ----------------------- | -------------------------------- |
| `maxLamportsPerTx`      | 2,000,000,000 (2 SOL)   | Prevents single large transfers  |
| `maxTxPerHour`          | 10                      | Limits runaway loops             |
| `maxTxPerDay`           | 50                      | Daily ceiling                    |
| `cooldownMs`            | 1,000 (1 sec)           | Prevents rapid-fire transactions |
| `maxDailySpendLamports` | 10,000,000,000 (10 SOL) | Daily spend cap                  |

### What Gets Checked

For every transaction:

1. **Amount vs. per-tx cap** — total lamports transferred ≤ maxLamportsPerTx
2. **Hourly rate** — transactions in the last hour < maxTxPerHour
3. **Daily rate** — transactions today < maxTxPerDay
4. **Cooldown** — time since last tx ≥ cooldownMs
5. **Daily spend** — cumulative spend today ≤ maxDailySpendLamports
6. **Program allowlist** — if set, only whitelisted programs may be called
7. **Program blocklist** — if set, blacklisted programs are rejected

### Policy Violations

When a check fails:

- The transaction is **not signed** and **not sent**
- An audit log entry is written with `success: false` and the violation reason
- The tool returns an error message explaining which limit was hit

---

## Human-Only Guardrail

`closeWallet` is the only destructive, irreversible operation. It is protected by a **compile-time type guard**:

```typescript
type HumanOnlyOpts = { __human_only_brand: never };
```

`WalletService.closeWallet()` requires this type as a parameter. No MCP tool can construct it — it has no runtime value. Only the CLI code passes it using a type assertion, and only after user confirmation.

This means:

- An agent **cannot** call `closeWallet` through any MCP tool
- An agent **cannot** close a wallet via a bash script — the scripts are read-only and have no signing capability
- Even if an agent somehow crafted the right TypeScript function call, compilation would reject it
- The protection is structural, not just "we didn't expose a tool for it"

---

## Audit Trail

Every operation is logged to `~/.agentic-wallet/logs/audit-YYYY-MM-DD.jsonl`:

```json
{
  "timestamp": "2025-01-15T10:30:00.000Z",
  "action": "sol:transfer",
  "walletId": "abc-123",
  "publicKey": "7xK...",
  "txSignature": "5vGk...",
  "success": true,
  "details": { "to": "Bx9...", "amountSol": 0.5 }
}
```

### Properties

- **Append-only:** Entries are appended with `appendFileSync`. No update or delete operations exist.
- **Every action:** Successes, failures, policy violations — all logged.
- **No sensitive data:** Private keys and passphrases never appear in logs. Only public keys and transaction metadata.

### Logged Actions

| Action                 | When                            |
| ---------------------- | ------------------------------- |
| `wallet:created`       | New wallet created              |
| `wallet:closed`        | Wallet closed (human-only)      |
| `sol:transfer`         | SOL sent                        |
| `token:transfer`       | SPL token sent                  |
| `swap:executed`        | Jupiter swap completed          |
| `memo:written`         | On-chain memo posted            |
| `mint:created`         | Token mint created              |
| `tokens:minted`        | Tokens minted                   |
| `policy:violation`     | Transaction blocked by policy   |
| `x402:payment_signed`  | x402 payment transaction signed |
| `x402:payment_success` | x402 payment settled            |
| `x402:payment_failed`  | x402 payment failed             |

---

## Threat Model Summary

| Threat                     | Mitigation                                                                |
| -------------------------- | ------------------------------------------------------------------------- |
| Agent leaks private key    | Keys never leave the encrypted keystore. No tool exposes them.            |
| Agent drains wallet        | Per-tx limit (2 SOL), daily cap (10 SOL), rate limits.                    |
| Agent enters infinite loop | 10 tx/hr rate limit + 1-second cooldown.                                  |
| Compromised passphrase     | 210,000 PBKDF2 iterations make brute force expensive.                     |
| Agent closes wallet        | Impossible — `HumanOnlyOpts` compile-time guard.                          |
| Injection via tool input   | All inputs validated by Zod schemas before handler runs.                  |
| Unauthorized program call  | Program allowlists limit which on-chain programs a wallet can invoke.     |
| Kora relay fails           | Automatic fallback to standard fee path — agent wallet pays its own fees. |
