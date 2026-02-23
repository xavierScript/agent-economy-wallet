---
name: check-balance
description: Check SOL and SPL token balances for any agent wallet
---

# Check Balance

Query the SOL balance and all SPL token balances for an agent wallet.

## When to Use

- Before executing a swap or transfer to ensure sufficient funds
- Monitoring agent wallet health
- Displaying portfolio overview
- Checking if an airdrop was received

## Command

```bash
agentic-wallet wallet balance <walletId>
```

## Parameters

| Parameter  | Type   | Required | Description        |
| ---------- | ------ | -------- | ------------------ |
| `walletId` | string | Yes      | Wallet ID to check |

## Example

```bash
agentic-wallet wallet balance a1b2c3d4-...

# Output:
#   Wallet: dca-agent
#   Public Key: 7xKXtg2CnuE...
#   SOL: 1.500000
#
#   SPL Tokens:
#     4zMMC9srt5... → 25.5
```

## Programmatic Usage

```typescript
// SOL balance
const { sol, lamports } = await walletService.getBalance(walletId);

// SPL token balances
const tokens = await walletService.getTokenBalances(walletId);
for (const t of tokens) {
  console.log(`${t.mint}: ${t.uiAmount} (${t.decimals} decimals)`);
}

// All wallet info
const info = await walletService.getWalletInfo(walletId);
```
