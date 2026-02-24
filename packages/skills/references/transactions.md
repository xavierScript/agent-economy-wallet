# Transactions

Execute transactions with agent wallets — SOL transfers, SPL token transfers, and token swaps.

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

## Swap Tokens

### CLI

```bash
agentic-wallet swap <walletId> --from <inputMint> --to <outputMint> --amount <rawAmount> --slippage <bps>

# Example: Swap 0.1 SOL for test-USDC on devnet
agentic-wallet swap a1b2c3d4-... \
  --from So11111111111111111111111111111111111111112 \
  --to <testUsdcMint> \
  --amount 100000000 \
  --slippage 100
```

### SDK

```typescript
import { DevnetSwapClient, SolanaConnection } from "@agentic-wallet/core";

// Devnet: on-chain AMM
const swapClient = new DevnetSwapClient(connection);
await swapClient.loadOrSetup();

const { quote, transaction } = await swapClient.buildSwap({
  inputMint: "So11111111111111111111111111111111111111112",
  outputMint: swapClient.getTestMint(),
  amount: 100_000_000, // 0.1 SOL in lamports
  userPublicKey: walletService.getPublicKey(walletId),
  slippageBps: 50, // 0.5% slippage
});

console.log(`Quote: ${quote.inAmount} → ${quote.outAmount}`);

const sig = await walletService.signAndSendVersionedTransaction(
  walletId,
  transaction,
  {
    action: "swap:devnet-amm",
    details: { inAmount: quote.inAmount, outAmount: quote.outAmount },
  },
);
```

### Parameters

| Parameter    | Type   | Required | Default | Description                                |
| ------------ | ------ | -------- | ------- | ------------------------------------------ |
| `walletId`   | string | Yes      |         | Wallet to use for the swap                 |
| `--from`     | string | Yes      |         | Input token mint address                   |
| `--to`       | string | Yes      |         | Output token mint address                  |
| `--amount`   | string | Yes      |         | Amount in smallest unit (lamports for SOL) |
| `--slippage` | string | No       | `50`    | Slippage tolerance in basis points         |

### Common Token Mints

| Token              | Mint Address                                            |
| ------------------ | ------------------------------------------------------- |
| SOL (wrapped)      | `So11111111111111111111111111111111111111112`           |
| test-USDC (devnet) | Created dynamically by `DevnetSwapClient.loadOrSetup()` |
| USDC (mainnet)     | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`          |

### How Swaps Work

**Devnet (DevnetSwapClient):**

1. Pool setup creates a test-USDC token and funds a pool authority
2. Quote calculated via constant-product formula: `output = (reserveOut × amountIn) / (reserveIn + amountIn)`
3. 0.3% fee applied
4. Builds a versioned transaction
5. Agent wallet signs and sends — real on-chain transaction

**Mainnet (JupiterClient):**

1. Jupiter API finds optimal route across all Solana DEXes
2. Returns a versioned transaction with the best route
3. Agent wallet signs and sends

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

| Type         | Signs With             | Method                                            |
| ------------ | ---------------------- | ------------------------------------------------- |
| SOL transfer | Legacy `Transaction`   | `walletService.signAndSendTransaction()`          |
| SPL transfer | Legacy `Transaction`   | `walletService.signAndSendTransaction()`          |
| Token swap   | `VersionedTransaction` | `walletService.signAndSendVersionedTransaction()` |
