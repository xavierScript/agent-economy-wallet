---
name: airdrop-devnet
description: Request free SOL on Solana devnet for testing agent wallets
---

# Airdrop Devnet SOL

Request free SOL from the Solana devnet faucet to fund agent wallets for testing.

## When to Use

- Initial wallet funding after creation
- Replenishing test funds
- Setting up demo environments
- Before running any devnet transactions

## Command

```bash
agentic-wallet wallet airdrop <walletId> --amount <sol>
```

## Parameters

| Parameter  | Type   | Required | Default | Description                                  |
| ---------- | ------ | -------- | ------- | -------------------------------------------- |
| `walletId` | string | Yes      |         | Wallet ID to fund                            |
| `--amount` | number | No       | `1`     | Amount of SOL to request (max 2 per request) |

## Example

```bash
agentic-wallet wallet airdrop a1b2c3d4-... --amount 2

# Output:
# ✓ Airdrop received! Signature: 3jKm...
```

## Programmatic Usage

```typescript
const sig = await walletService.requestAirdrop(walletId, 2);
console.log("Airdrop signature:", sig);
```

## Notes

- Only works on devnet and testnet clusters
- Rate limited by Solana RPC — may fail if requested too frequently
- Maximum 2 SOL per airdrop request
- Wait a few seconds between requests
