# Transactions

Execute transactions with agent wallets — SOL transfers and SPL token transfers.

⚠️ Before every transaction, complete the security checklist in [security.md](security.md).

## Send SOL

### CLI

```bash
agentic-wallet send sol <walletId> <recipientAddress> <amountSOL>

# Example:
agentic-wallet send sol a1b2c3d4-... 7xKXtg2CnuE9p5dPHQc... 0.5
# ✓ Sent! Signature: 5vGk...
```

### SDK

```typescript
import { PublicKey } from "@solana/web3.js";

const fromPk = new PublicKey(walletService.getPublicKey(walletId));
const toPk = new PublicKey("7xKXtg2CnuE...");
const tx = txBuilder.buildSolTransfer(fromPk, toPk, 0.5);
const sig = await walletService.signAndSendTransaction(walletId, tx, {
  action: "sol:transfer",
  details: { to: toPk.toBase58(), amount: 0.5 },
});
```

### Parameters

| Parameter          | Type   | Required | Description                          |
| ------------------ | ------ | -------- | ------------------------------------ |
| `walletId`         | string | Yes      | Source wallet ID                     |
| `recipientAddress` | string | Yes      | Recipient Solana public key (base58) |
| `amountSOL`        | number | Yes      | Amount of SOL to send                |

### Policy Enforcement

SOL transfers are checked against:

- `maxLamportsPerTx` — amount must be under the per-tx limit
- `maxTxPerHour` / `maxTxPerDay` — rate limits
- `cooldownMs` — minimum time since last transaction
- `maxDailySpendLamports` — cumulative daily cap
- `allowedPrograms` — System Program must be in the allowlist

---

## Send SPL Tokens

### CLI

```bash
agentic-wallet send token <walletId> <recipientAddress> <mintAddress> <amount> <decimals>

# Example (send 10 USDC):
agentic-wallet send token a1b2c3d4-... 7xKXtg2C... EPjFWdd5Auf... 10 6
```

### SDK

```typescript
const fromPk = new PublicKey(walletService.getPublicKey(walletId));
const toPk = new PublicKey("recipient...");
const mint = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

const tx = await txBuilder.buildTokenTransfer(fromPk, toPk, mint, 10.5, 6);
const sig = await walletService.signAndSendTransaction(walletId, tx, {
  action: "spl:transfer",
  details: { to: toPk.toBase58(), mint: mint.toBase58(), amount: 10.5 },
});
```

### Parameters

| Parameter          | Type   | Required | Description                             |
| ------------------ | ------ | -------- | --------------------------------------- |
| `walletId`         | string | Yes      | Source wallet ID                        |
| `recipientAddress` | string | Yes      | Recipient public key                    |
| `mintAddress`      | string | Yes      | Token mint address                      |
| `amount`           | number | Yes      | Human-readable amount (e.g., 10.5 USDC) |
| `decimals`         | number | Yes      | Token decimals (6 for USDC, 9 for SOL)  |

### Notes

- Recipient's Associated Token Account is created automatically if needed
- Sender pays ~0.002 SOL rent for new ATA creation
- Both Token Program and ATA Program must be in the policy allowlist

---

## Error Handling

| Error                           | Cause                                 | Fix                                                    |
| ------------------------------- | ------------------------------------- | ------------------------------------------------------ |
| `Policy violation: ...`         | Transaction exceeds policy limits     | Check policy with `policyEngine.getTransactionStats()` |
| `Insufficient funds`            | Wallet doesn't have enough SOL/tokens | Fund wallet or reduce amount                           |
| `429 Too Many Requests`         | Devnet RPC rate limit                 | Wait 15-30s and retry                                  |
| `Transaction simulation failed` | Invalid transaction                   | Check accounts, amounts, and programs                  |

---

## Transaction Types

| Type         | Signs With           | Method                                   |
| ------------ | -------------------- | ---------------------------------------- |
| SOL transfer | Legacy `Transaction` | `walletService.signAndSendTransaction()` |
| SPL transfer | Legacy `Transaction` | `walletService.signAndSendTransaction()` |
