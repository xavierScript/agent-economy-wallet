import type {
  IAgentStrategy,
  StrategyContext,
  StrategyResult,
} from "./base.js";

/**
 * Arbitrage Monitoring Strategy.
 *
 * Compares prices across routes to find arbitrage opportunities.
 * Executes a circular swap if profit exceeds threshold.
 *
 * Config:
 * - tokenMint: The token to check arb on (vs SOL)
 * - minProfitBps: Minimum profit in basis points to execute (default 30 = 0.3%)
 * - tradeAmount: Amount in lamports for arb check
 * - intervalMs: Check interval
 */
export class ArbitrageStrategy implements IAgentStrategy {
  readonly name = "arbitrage";
  readonly description =
    "Arbitrage monitoring - detect and report price discrepancies";

  private lastCheckTime = 0;

  async execute(context: StrategyContext): Promise<StrategyResult> {
    const {
      tokenMint,
      minProfitBps = 30,
      tradeAmount = 100_000_000, // 0.1 SOL
      intervalMs = 30_000,
    } = context.config as Record<string, any>;

    const now = Date.now();
    if (now - this.lastCheckTime < Number(intervalMs)) {
      return {
        success: true,
        action: "arbitrage:waiting",
        details: {
          nextCheckAt: new Date(
            this.lastCheckTime + Number(intervalMs),
          ).toISOString(),
        },
      };
    }

    this.lastCheckTime = now;

    if (!tokenMint) {
      return {
        success: false,
        action: "arbitrage:skip",
        details: { reason: "No tokenMint configured" },
      };
    }

    const SOL_MINT = "So11111111111111111111111111111111111111112";

    try {
      // Step 1: SOL → Token quote
      const forwardQuote = await context.swapClient.getQuote({
        inputMint: SOL_MINT,
        outputMint: tokenMint as string,
        amount: Number(tradeAmount),
        slippageBps: 10,
      });

      // Step 2: Token → SOL quote (reverse)
      const reverseQuote = await context.swapClient.getQuote({
        inputMint: tokenMint as string,
        outputMint: SOL_MINT,
        amount: Number(forwardQuote.outAmount),
        slippageBps: 10,
      });

      // Calculate profit
      const inputLamports = Number(tradeAmount);
      const outputLamports = Number(reverseQuote.outAmount);
      const profitLamports = outputLamports - inputLamports;
      const profitBps = (profitLamports / inputLamports) * 10_000;

      const profitDetected = profitBps > Number(minProfitBps);

      return {
        success: true,
        action: profitDetected
          ? "arbitrage:opportunity"
          : "arbitrage:no-opportunity",
        details: {
          tokenMint,
          inputLamports,
          outputLamports,
          profitLamports,
          profitBps: Math.round(profitBps * 100) / 100,
          profitPct: Math.round(profitBps) / 100,
          minProfitBps,
          forwardRoute: forwardQuote.routePlan
            .map((r) => r.swapInfo.label)
            .join(" → "),
          reverseRoute: reverseQuote.routePlan
            .map((r) => r.swapInfo.label)
            .join(" → "),
          executable: profitDetected,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        action: "arbitrage:error",
        details: { error: error.message },
      };
    }
  }
}
