---
name: swap-tokens
description: Swap tokens using on-chain AMM with protocol-agnostic swap interface
---

# Swap Tokens

Swap tokens via the protocol-agnostic `ISwapClient` interface. On devnet, uses a real on-chain constant-product AMM pool (DevnetSwapClient). On mainnet, routes through Jupiter DEX aggregator for best pricing.

## When to Use

- Converting between any two SPL tokens
- Dollar-cost averaging into a position
- Taking profits by swapping tokens to stables
- Rebalancing a portfolio

## Command

```bash
agentic-wallet swap <walletId> --from <inputMint> --to <outputMint> --amount <rawAmount> --slippage <bps>
```

## Parameters

| Parameter    | Type   | Required | Default | Description                                    |
| ------------ | ------ | -------- | ------- | ---------------------------------------------- |
| `walletId`   | string | Yes      |         | Wallet to use for the swap                     |
| `--from`     | string | Yes      |         | Input token mint address                       |
| `--to`       | string | Yes      |         | Output token mint address                      |
| `--amount`   | string | Yes      |         | Amount in smallest unit (lamports for SOL)     |
| `--slippage` | string | No       | `50`    | Slippage tolerance in basis points (50 = 0.5%) |

## Common Mints

| Token              | Mint Address                                       |
| ------------------ | -------------------------------------------------- |
| SOL                | `So11111111111111111111111111111111111111112`      |
| test-USDC (devnet) | Created dynamically by DevnetSwapClient pool setup |
| USDC (mainnet)     | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`     |

## Example

```bash
# Swap 0.1 SOL to test-USDC on devnet
agentic-wallet swap <walletId> \
  --from So11111111111111111111111111111111111111112 \
  --to <testUsdcMint> \
  --amount 100000000 \
  --slippage 100
```

## Programmatic Usage

```typescript
import { DevnetSwapClient, SolanaConnection } from "@agentic-wallet/core";

// Initialize devnet swap client
const connection = new SolanaConnection(
  "https://api.devnet.solana.com",
  "devnet",
);
const swapClient = new DevnetSwapClient(connection);
await swapClient.loadOrSetup(); // Creates pool on first run

const { quote, transaction } = await swapClient.buildSwap({
  inputMint: "So11111111111111111111111111111111111111112",
  outputMint: swapClient.getTestMint(),
  amount: 100_000_000,
  userPublicKey: walletService.getPublicKey(walletId),
  slippageBps: 50,
});

const sig = await walletService.signAndSendVersionedTransaction(
  walletId,
  transaction,
  {
    action: "swap:devnet-amm",
    details: { inAmount: quote.inAmount, outAmount: quote.outAmount },
  },
);
```

## How It Works

### Devnet (DevnetSwapClient)

1. **Pool Setup**: Creates a test-USDC token and funds a pool authority with reserves
2. **Quote**: Calculates output using constant-product formula (x \* y = k)
3. **Transaction**: Builds a versioned transaction transferring tokens between user and pool
4. **Sign**: The agent wallet signs the transaction
5. **Execute**: Real on-chain transaction is confirmed on devnet

### Mainnet (JupiterClient)

1. **Quote**: Jupiter API finds the best route across all DEXes
2. **Transaction**: A versioned transaction is built with the optimal route
3. **Sign**: The agent wallet signs the transaction
4. **Execute**: Transaction is sent and confirmed on-chain
