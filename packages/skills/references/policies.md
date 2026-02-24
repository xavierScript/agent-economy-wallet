# Policies

⚠️ **MANDATORY: Every wallet MUST have a policy.** Without policies, an agent wallet can send unlimited amounts to any address. No exceptions.

## Why Policies Are Required

Without policies, an agent wallet can:

- Send its entire balance in one transaction
- Execute unlimited transactions per second
- Interact with any program (including malicious ones)
- Drain the wallet with no guardrails

**Never create a wallet without a policy.**

## Default Devnet Policy

The SDK provides a pre-configured safety policy for devnet:

```typescript
const policy = PolicyEngine.createDevnetPolicy("my-policy");
```

This creates:

| Rule                    | Limit                                         |
| ----------------------- | --------------------------------------------- |
| `maxLamportsPerTx`      | 2,000,000,000 (2 SOL)                         |
| `maxTxPerHour`          | 30                                            |
| `maxTxPerDay`           | 200                                           |
| `cooldownMs`            | 2,000 (2 seconds)                             |
| `maxDailySpendLamports` | 10,000,000,000 (10 SOL)                       |
| `allowedPrograms`       | System, Token, ATA, Jupiter v6, ComputeBudget |

## Create Custom Policy

```typescript
import { PolicyEngine } from "@agentic-wallet/core";

const policy = {
  id: "conservative-agent",
  name: "Conservative Safety Policy",
  rules: [
    {
      name: "Low spending limit",
      maxLamportsPerTx: 500_000_000, // 0.5 SOL max per tx
      maxTxPerHour: 10, // 10 tx/hour
      maxTxPerDay: 50, // 50 tx/day
      cooldownMs: 5_000, // 5 second cooldown
      maxDailySpendLamports: 2_000_000_000, // 2 SOL daily cap
      allowedPrograms: [
        "11111111111111111111111111111111", // System Program
        "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", // Token Program
      ],
    },
  ],
  createdAt: new Date().toISOString(),
};

// Attach to a wallet
policyEngine.attachPolicy(walletId, policy);
```

## Policy Rule Fields

| Field                   | Type     | Description                               |
| ----------------------- | -------- | ----------------------------------------- |
| `name`                  | string   | Human-readable rule name                  |
| `maxLamportsPerTx`      | number   | Maximum lamports per single transaction   |
| `maxTxPerHour`          | number   | Maximum transactions in a rolling hour    |
| `maxTxPerDay`           | number   | Maximum transactions in a rolling day     |
| `cooldownMs`            | number   | Minimum milliseconds between transactions |
| `maxDailySpendLamports` | number   | Maximum total lamports spent in a day     |
| `allowedPrograms`       | string[] | Only these program IDs can be called      |
| `blockedPrograms`       | string[] | These program IDs are blocked             |

## Recommended Policy Templates

### 🔒 Conservative (Recommended for Start)

Maximum safety, minimum risk:

```typescript
{
  name: "Conservative",
  maxLamportsPerTx: 100_000_000,       // 0.1 SOL
  maxTxPerHour: 5,
  maxTxPerDay: 20,
  cooldownMs: 10_000,                  // 10 seconds
  maxDailySpendLamports: 500_000_000,  // 0.5 SOL daily
  allowedPrograms: [
    "11111111111111111111111111111111", // System Program only
  ],
}
```

### ⚖️ Moderate (Trading Agent)

Balanced for regular DCA/swap operations:

```typescript
{
  name: "Moderate Trading",
  maxLamportsPerTx: 1_000_000_000,      // 1 SOL
  maxTxPerHour: 20,
  maxTxPerDay: 100,
  cooldownMs: 3_000,
  maxDailySpendLamports: 5_000_000_000, // 5 SOL daily
  allowedPrograms: [
    "11111111111111111111111111111111",              // System
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",  // Token
    "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",  // ATA
    "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",  // Jupiter v6
    "ComputeBudget111111111111111111111111111111",    // ComputeBudget
  ],
}
```

## ⚠️ Policy Anti-Patterns

**Never do these:**

```typescript
// ❌ No spending limit
{ name: "Allow everything", maxLamportsPerTx: undefined }

// ❌ Limit too high
{ maxLamportsPerTx: 100_000_000_000 } // 100 SOL!

// ❌ No rate limit
{ maxTxPerHour: undefined, maxTxPerDay: undefined }

// ❌ Empty allowlist (allows any program)
{ allowedPrograms: [] }
```

## How Policy Checks Work

```
Transaction submitted
    │
    ▼
PolicyEngine.checkTransaction()
    │
    ├── Check maxLamportsPerTx → BLOCK if over limit
    ├── Check maxTxPerHour     → BLOCK if over limit
    ├── Check maxTxPerDay      → BLOCK if over limit
    ├── Check cooldownMs       → BLOCK if too soon
    ├── Check dailySpend       → BLOCK if over daily cap
    ├── Check allowedPrograms  → BLOCK if unknown program
    └── Check blockedPrograms  → BLOCK if blocklisted
    │
    ▼
  Returns null (allowed) or violation string (blocked)
```

If a violation is detected, the transaction is **not signed and not sent**. The violation is logged to the audit trail.

## View Policy Stats

```typescript
const stats = policyEngine.getTransactionStats(walletId);
// → { txLastHour: 5, txLastDay: 23, spendLastDay: 1500000000, lastTxTime: 1705312200000 }
```

## Allowed Solana Programs

| Program                  | Address                                        | Purpose                         |
| ------------------------ | ---------------------------------------------- | ------------------------------- |
| System Program           | `11111111111111111111111111111111`             | SOL transfers, account creation |
| Token Program            | `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`  | SPL token operations            |
| Associated Token Account | `ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL` | Token account creation          |
| Jupiter v6               | `JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4`  | DEX aggregator swaps            |
| Compute Budget           | `ComputeBudget111111111111111111111111111111`  | Priority fees                   |
