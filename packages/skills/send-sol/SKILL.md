---
name: send-sol
description: Send SOL from an agent wallet to any Solana address with policy enforcement
---

# Send SOL

Transfer SOL from an agent wallet to a recipient address. The transaction goes through policy checks (spending limits, rate limits, program allowlists) before signing.

## When to Use

- Paying for services or goods on-chain
- Funding another wallet or agent
- Distributing rewards or splitting profits
- Any SOL transfer operation

## Command

```bash
agentic-wallet send sol <walletId> <recipientAddress> <amountSOL>
```

## Parameters

| Parameter          | Type   | Required | Description                            |
| ------------------ | ------ | -------- | -------------------------------------- |
| `walletId`         | string | Yes      | Source wallet ID                       |
| `recipientAddress` | string | Yes      | Recipient's Solana public key (base58) |
| `amountSOL`        | number | Yes      | Amount of SOL to send                  |

## Example

```bash
agentic-wallet send sol a1b2c3d4-... 7xKXtg2CnuE...  0.5

# Output:
# ✓ Sent! Signature: 5vGk...
```

## Programmatic Usage

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

## Policy Enforcement

The following policy checks are applied before signing:

- **Spending limit**: Max lamports per transaction
- **Rate limit**: Max transactions per hour/day
- **Cooldown**: Minimum time between transactions
- **Daily cap**: Maximum total daily spend
- **Program allowlist**: Only System Program is used for SOL transfers
