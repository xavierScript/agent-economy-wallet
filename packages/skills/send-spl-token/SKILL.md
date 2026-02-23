---
name: send-spl-token
description: Transfer SPL tokens between wallets with automatic token account creation
---

# Send SPL Token

Transfer SPL tokens from an agent wallet to a recipient. Automatically creates the recipient's Associated Token Account if it doesn't exist.

## When to Use

- Transferring USDC, USDT, or any SPL token
- Distributing token rewards
- Moving tokens between agent wallets

## Command

```bash
agentic-wallet send token <walletId> <recipientAddress> <mintAddress> <amount> <decimals>
```

## Parameters

| Parameter          | Type   | Required | Description                                      |
| ------------------ | ------ | -------- | ------------------------------------------------ |
| `walletId`         | string | Yes      | Source wallet ID                                 |
| `recipientAddress` | string | Yes      | Recipient public key                             |
| `mintAddress`      | string | Yes      | Token mint address                               |
| `amount`           | number | Yes      | Amount in human-readable units (e.g., 10.5 USDC) |
| `decimals`         | number | Yes      | Token decimals (6 for USDC, 9 for SOL)           |

## Programmatic Usage

```typescript
import { PublicKey } from "@solana/web3.js";

const fromPk = new PublicKey(walletService.getPublicKey(walletId));
const toPk = new PublicKey("recipient...");
const mint = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"); // USDC devnet

const tx = await txBuilder.buildTokenTransfer(fromPk, toPk, mint, 10.5, 6);
const sig = await walletService.signAndSendTransaction(walletId, tx, {
  action: "spl:transfer",
  details: { to: toPk.toBase58(), mint: mint.toBase58(), amount: 10.5 },
});
```

## Notes

- If the recipient doesn't have a token account for the mint, one is created automatically (the sender pays ~0.002 SOL rent)
- Uses Associated Token Accounts (ATAs) for deterministic addresses
- Both Token Program and Associated Token Account Program are whitelisted in the default policy
