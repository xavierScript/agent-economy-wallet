import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import type {
  IAgentStrategy,
  StrategyContext,
  StrategyResult,
} from "./base.js";

/**
 * Dollar-Cost Averaging (DCA) Strategy.
 *
 * Periodically swaps a fixed amount of one token for another.
 * Ideal for agents that want to accumulate a position over time.
 *
 * Config:
 * - inputMint: Token to sell (e.g., SOL)
 * - outputMint: Token to buy (e.g., USDC)
 * - amountPerSwap: Amount of input token per swap (in smallest unit)
 * - intervalMs: Time between swaps (minimum enforced)
 * - slippageBps: Slippage tolerance (default 50 = 0.5%)
 */
export class DCAStrategy implements IAgentStrategy {
  readonly name = "dca";
  readonly description =
    "Dollar-Cost Averaging - periodically swap a fixed amount of tokens";

  private lastSwapTime = 0;

  async execute(context: StrategyContext): Promise<StrategyResult> {
    const {
      inputMint = "So11111111111111111111111111111111111111112",
      outputMint,
      amountPerSwap = 100_000_000, // 0.1 SOL default
      intervalMs = 60_000,
      slippageBps = 50,
    } = context.config as Record<string, any>;

    if (!outputMint) {
      return {
        success: false,
        action: "dca:skip",
        details: { reason: "No outputMint configured" },
      };
    }

    // Check interval
    const now = Date.now();
    if (now - this.lastSwapTime < intervalMs) {
      const waitSec = Math.ceil(
        (intervalMs - (now - this.lastSwapTime)) / 1000,
      );
      return {
        success: true,
        action: "dca:waiting",
        details: {
          waitSeconds: waitSec,
          nextSwapAt: new Date(this.lastSwapTime + intervalMs).toISOString(),
        },
      };
    }

    try {
      // Get quote
      const quote = await context.swapClient.getQuote({
        inputMint: inputMint as string,
        outputMint: outputMint as string,
        amount: Number(amountPerSwap),
        slippageBps: Number(slippageBps),
      });

      // Build swap transaction
      const publicKey = context.walletService.getPublicKey(context.walletId);
      const tx = await context.swapClient.getSwapTransaction({
        quoteResponse: quote,
        userPublicKey: publicKey,
      });

      // Execute
      const sig = await context.walletService.signAndSendVersionedTransaction(
        context.walletId,
        tx,
        {
          action: "dca:swap",
          details: {
            inputMint,
            outputMint,
            amountPerSwap: Number(amountPerSwap),
          },
        },
      );

      this.lastSwapTime = Date.now();

      return {
        success: true,
        action: "dca:swapped",
        txSignature: sig,
        details: {
          inputMint,
          outputMint,
          inAmount: quote.inAmount,
          outAmount: quote.outAmount,
          priceImpact: quote.priceImpactPct,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        action: "dca:error",
        details: { error: error.message },
      };
    }
  }
}
