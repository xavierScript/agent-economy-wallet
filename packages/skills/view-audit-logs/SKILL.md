---
name: view-audit-logs
description: View the immutable audit trail of all wallet operations and agent actions
---

# View Audit Logs

View the audit trail of all wallet operations. Every action (wallet creation, transfers, swaps, agent ticks) is logged to JSONL files with timestamps.

## When to Use

- Debugging failed transactions
- Reviewing agent activity history
- Compliance and audit trail
- Monitoring for unexpected behavior

## Command

```bash
# View last 20 log entries
agentic-wallet logs

# View more entries
agentic-wallet logs --count 50

# Filter by wallet
agentic-wallet logs --wallet <walletId>
```

## Parameters

| Parameter  | Type   | Required | Default | Description               |
| ---------- | ------ | -------- | ------- | ------------------------- |
| `--count`  | number | No       | `20`    | Number of entries to show |
| `--wallet` | string | No       |         | Filter by wallet ID       |

## Log Format

Each log entry contains:

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "action": "sol:transfer",
  "walletId": "a1b2c3d4-...",
  "publicKey": "7xKXtg2CnuE...",
  "txSignature": "5vGk...",
  "success": true,
  "details": { "to": "...", "amount": 0.5 }
}
```

## Programmatic Usage

```typescript
// Recent logs
const logs = auditLogger.readRecentLogs(50);

// Wallet-specific logs
const walletLogs = auditLogger.readWalletLogs(walletId, 20);

// Today's logs
const todayLogs = auditLogger.readLogs(); // defaults to today

// Real-time listener
const unsubscribe = auditLogger.onLog((entry) => {
  console.log(`[${entry.action}] ${entry.success ? "✓" : "✗"}`);
});
```

## Storage

- Logs stored in `~/.agentic-wallet/logs/audit-YYYY-MM-DD.jsonl`
- One file per day, one JSON object per line (JSONL format)
- Logs are append-only — never modified or deleted
