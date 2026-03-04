# Wallets Reference

> Wallet lifecycle, policy configuration, and multi-wallet patterns.

---

## Wallet Lifecycle

```
create_wallet() → Active (policy attached, auto-funded)
                     │
                     ├── send_sol / send_token / swap_tokens / pay_x402
                     ├── get_balance / get_policy / get_audit_logs
                     │
              [Human-only via CLI]
                     │
                     ▼
               close_wallet() → Swept (remaining SOL sent to owner) → Deleted
```

### Creation

When `create_wallet` is called:

1. An Ed25519 keypair is generated
2. The private key is encrypted (AES-256-GCM + PBKDF2) and saved to `~/.agentic-wallet/keys/<uuid>.json`
3. The devnet safety policy is attached (mandatory, cannot be skipped)
4. If `MASTER_WALLET_SECRET_KEY` is configured, the wallet receives `AGENT_SEED_SOL` (default: 0.05 SOL) automatically
5. `wallet:created` is logged to the audit trail

### Active State

A wallet in active state can:

- Hold SOL and SPL tokens
- Sign and send transactions (within policy limits)
- Be queried for balances and policy status

### Closure (Human-Only)

Wallet closure is **irreversible** and **human-only**:

1. Human initiates closure via CLI (`close_wallet`)
2. Remaining SOL is swept to `OWNER_ADDRESS` (if configured)
3. The keystore file is deleted from disk
4. `wallet:closed` is logged
5. The wallet ID becomes permanently invalid

**Agents cannot close wallets.** This is enforced at compile time via the `HumanOnlyOpts` type guard.

---

## Policy Details

### Policy Structure

```typescript
interface PolicyRule {
  name: string; // Rule identifier
  maxLamportsPerTx?: number; // Per-transaction spend cap
  maxTxPerHour?: number; // Hourly rate limit
  maxTxPerDay?: number; // Daily rate limit
  cooldownMs?: number; // Min time between transactions
  allowedPrograms?: string[]; // Program whitelist (empty = all allowed)
  blockedPrograms?: string[]; // Program blacklist
  maxDailySpendLamports?: number; // Daily cumulative spend cap
}
```

### Default Devnet Policy Values

| Rule                    | Value          | Human-Readable                 |
| ----------------------- | -------------- | ------------------------------ |
| `maxLamportsPerTx`      | 2,000,000,000  | 2 SOL per transaction          |
| `maxTxPerHour`          | 30             | 30 transactions per hour       |
| `maxTxPerDay`           | 200            | 200 transactions per day       |
| `cooldownMs`            | 2,000          | 2 seconds between transactions |
| `maxDailySpendLamports` | 10,000,000,000 | 10 SOL per day total           |

### Policy Checking Flow

```
Transaction submitted
    │
    ▼
Is there a policy attached?
    ├── No  → allow (but warn in logs)
    └── Yes → check each rule:
                ├── Amount ≤ maxLamportsPerTx?
                ├── Hourly count < maxTxPerHour?
                ├── Daily count < maxTxPerDay?
                ├── Time since last tx ≥ cooldownMs?
                ├── Daily spend + this tx ≤ maxDailySpendLamports?
                ├── Program in allowedPrograms? (if list is set)
                └── Program NOT in blockedPrograms?
                    │
                    ├── All pass → sign and send
                    └── Any fail → reject, log violation
```

### Rate Limit Windows

- **Hourly:** Rolling 60-minute window from current time
- **Daily:** Rolling 24-hour window from current time
- **Cooldown:** Time since the most recent transaction

Rate limit state is tracked in memory and persisted to `~/.agentic-wallet/keys/policy-state.json` so it survives process restarts.

---

## Multi-Wallet Patterns

### One Wallet Per Agent

The simplest pattern. Each AI agent gets its own wallet with its own policy:

```
Agent A → Wallet A (trading bot, 2 SOL/tx)
Agent B → Wallet B (payment agent, 2 SOL/tx)
Agent C → Wallet C (data buyer, 2 SOL/tx)
```

### Role-Based Wallets

Create wallets with descriptive labels for different purposes:

```
create_wallet(label: "hot-trading")     → for active trading
create_wallet(label: "cold-holding")    → for long-term storage
create_wallet(label: "payment-agent")   → for x402 API payments
```

### Portfolio Rebalancing

Multiple wallets can be rebalanced using the `portfolio-rebalance` prompt:

```
list_wallets() → get all wallet IDs and balances
For each wallet:
  get_balance(wallet_id) → current allocation
Calculate target allocations
For wallets over-allocated: send_sol to under-allocated wallets
```

---

## Wallet Data Locations

| Data                | Location                                        |
| ------------------- | ----------------------------------------------- |
| Encrypted keystores | `~/.agentic-wallet/keys/<uuid>.json`            |
| Policy state        | `~/.agentic-wallet/keys/policy-state.json`      |
| Audit logs          | `~/.agentic-wallet/logs/audit-YYYY-MM-DD.jsonl` |

All paths are relative to the user's home directory. On Windows, `~` resolves to `%USERPROFILE%`.
