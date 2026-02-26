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

## Swap Tokens (Jupiter)

Swap any SPL token via the Jupiter aggregator — Solana's primary DEX aggregator. Routes across multiple liquidity sources for the best price.

### MCP Tool

Use the `swap_tokens` tool:

```json
{
  "wallet_id": "a1b2c3d4-...",
  "input_token": "SOL",
  "output_token": "USDC",
  "amount": 0.1,
  "slippage_bps": 50
}
```

### SDK

```typescript
import { JupiterService } from "@agentic-wallet/core";

const jupiter = new JupiterService();

// Get a quote
const inputMint = jupiter.resolveTokenMint("SOL");
const outputMint = jupiter.resolveTokenMint("USDC");
const rawAmount = jupiter.toRawAmount(0.1, 9); // 9 decimals for SOL
const quote = await jupiter.getQuote(inputMint, outputMint, rawAmount, 50);

// Build the swap transaction
const swapTx = await jupiter.getSwapTransaction(quote, walletPublicKey);

// Sign and send (policy-checked)
const sig = await walletService.signAndSendVersionedTransaction(
  walletId,
  swapTx,
  {
    action: "swap:jupiter",
    details: { inputToken: "SOL", outputToken: "USDC", inputAmount: 0.1 },
  },
);
```

### Parameters

| Parameter      | Type   | Required | Description                                             |
| -------------- | ------ | -------- | ------------------------------------------------------- |
| `wallet_id`    | string | Yes      | Source wallet ID                                        |
| `input_token`  | string | Yes      | Input token symbol (SOL, USDC, etc.) or mint address    |
| `output_token` | string | Yes      | Output token symbol or mint address                     |
| `amount`       | number | Yes      | Amount of input token (human-readable)                  |
| `slippage_bps` | number | No       | Slippage tolerance in basis points (default: 50 = 0.5%) |

### Supported Tokens (by symbol)

| Symbol | Name        | Mint                                           |
| ------ | ----------- | ---------------------------------------------- |
| SOL    | Wrapped SOL | `So11111111111111111111111111111111111111112`  |
| USDC   | USD Coin    | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` |
| USDT   | Tether USD  | `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB` |
| BONK   | Bonk        | `DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263` |
| JUP    | Jupiter     | `JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN`  |

Any SPL token can be swapped by providing its full mint address.

### Safety

- **Price impact cap**: Swaps with >5% price impact are rejected
- **Slippage cap**: Maximum 3% (300 bps) slippage enforced
- **Policy enforcement**: Rate limits and spending caps still apply
- **Versioned transactions**: Jupiter uses VersionedTransaction (v0)

---

## Write On-Chain Memo

Store a text message permanently in the Solana transaction log using the SPL Memo Program.
Useful for agent decision logs, audit notes, and simple on-chain presence.

### MCP Tool

```json
{
  "wallet_id": "a1b2c3d4-...",
  "message": "Agent decision: auto-compounding at 12:00 UTC",
  "transfer_to": "7xKXtg2C...",   ← optional: attach a SOL amount
  "transfer_amount": 0.001        ← optional
}
```

### SDK

```typescript
const signerPk = new PublicKey(walletService.getPublicKey(walletId));
const tx = txBuilder.buildMemo(signerPk, "Hello, Solana!");
await walletService.signAndSendTransaction(walletId, tx, {
  action: "memo:write",
  details: { message: "Hello, Solana!" },
});
```

### Parameters

| Parameter         | Type   | Required | Description                                        |
| ----------------- | ------ | -------- | -------------------------------------------------- |
| `wallet_id`       | string | Yes      | Wallet ID (UUID) that signs the memo               |
| `message`         | string | Yes      | Memo text — max 500 chars, stored on-chain forever |
| `transfer_to`     | string | No       | Attach an optional SOL transfer to the same tx     |
| `transfer_amount` | number | No       | SOL amount to transfer alongside the memo          |

---

## Request Airdrop (Devnet Only)

Fund a devnet wallet with free SOL. Max 2 SOL per request.
If the RPC rate-limits the direct airdrop, the tool returns a fallback link to https://faucet.solana.com.

### MCP Tool

```json
{
  "wallet_id": "a1b2c3d4-...",
  "amount": 1
}
```

### Response

```json
{
  "success": true,
  "amount": 1,
  "signature": "5vGk...",
  "newBalance": 1.0,
  "explorer": "https://explorer.solana.com/tx/5vGk...?cluster=devnet"
}
```

If airdrop fails (rate limited), the response includes step-by-step fallback instructions with the faucet URL.

### Notes

- Devnet/testnet only — will error on mainnet
- Max 2 SOL per request (devnet RPC enforced)
- Wait 15–30 s between requests to avoid rate limits

---

## Create Token Mint

Create a new SPL token mint. The signing wallet becomes the mint authority and can later mint tokens.

### MCP Tool

```json
{
  "wallet_id": "a1b2c3d4-...",
  "decimals": 9
}
```

### Response

```json
{
  "success": true,
  "mintAddress": "AaBbCc...",
  "mintAuthority": "7xKXtg...",
  "decimals": 9,
  "signature": "5vGk...",
  "explorer": "https://explorer.solana.com/address/AaBbCc...?cluster=devnet"
}
```

### Workflow

1. `create_token_mint` → get a `mintAddress`
2. `mint_tokens` → mint supply to a wallet
3. `send_token` → distribute tokens

---

## Mint Tokens

Mint new tokens from an existing SPL token mint to any wallet.
The signing wallet must be the current mint authority.
Automatically creates the recipient's Associated Token Account if it doesn't exist yet.

### MCP Tool

```json
{
  "wallet_id": "a1b2c3d4-...",
  "mint": "AaBbCc...",
  "to": "7xKXtg...",
  "amount": 1000
}
```

The `to` field is optional — defaults to the signing wallet itself.

### Response

```json
{
  "success": true,
  "signature": "5vGk...",
  "mint": "AaBbCc...",
  "recipient": "7xKXtg...",
  "amountMinted": 1000,
  "tokenAccount": "DdEeFf...",
  "explorer": "https://explorer.solana.com/tx/5vGk...?cluster=devnet"
}
```

---

## Transaction Types

| Type              | Signs With                  | Method                                                |
| ----------------- | --------------------------- | ----------------------------------------------------- |
| SOL transfer      | Legacy `Transaction`        | `walletService.signAndSendTransaction()`              |
| SPL transfer      | Legacy `Transaction`        | `walletService.signAndSendTransaction()`              |
| Token swap        | `VersionedTransaction` (v0) | `walletService.signAndSendVersionedTransaction()`     |
| On-chain memo     | Legacy `Transaction`        | `walletService.signAndSendTransaction()`              |
| Create token mint | Legacy `Transaction`        | `walletService.signAndSendTransaction([mintKeypair])` |
| Mint tokens       | Legacy `Transaction`        | `walletService.signAndSendTransaction()`              |
