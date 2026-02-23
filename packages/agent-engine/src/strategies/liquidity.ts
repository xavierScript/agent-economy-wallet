import type {
  IAgentStrategy,
  StrategyContext,
  StrategyResult,
} from "./base.js";

/**
 * Liquidity Provision Strategy.
 *
 * Monitors optimal LP positions and provides liquidity when conditions are met.
 * This is a monitoring/analysis strategy — actual LP operations are demonstrated
 * through the analysis output.
 *
 * Config:
 * - tokenA: First token mint
 * - tokenB: Second token mint
 * - maxSlippage: Maximum acceptable slippage for LP entry
 * - intervalMs: Check interval
 */
export class LiquidityStrategy implements IAgentStrategy {
  readonly name = "liquidity";
  readonly description =
    "Liquidity monitoring - analyze LP positions and conditions";

  private lastCheckTime = 0;

  async execute(context: StrategyContext): Promise<StrategyResult> {
    const {
      tokenA = "So11111111111111111111111111111111111111112",
      tokenB,
      maxSlippage = 1,
      intervalMs = 180_000,
    } = context.config as Record<string, any>;

    const now = Date.now();
    if (now - this.lastCheckTime < Number(intervalMs)) {
      return {
        success: true,
        action: "liquidity:waiting",
        details: {
          nextCheckAt: new Date(
            this.lastCheckTime + Number(intervalMs),
          ).toISOString(),
        },
      };
    }

    this.lastCheckTime = now;

    if (!tokenB) {
      return {
        success: false,
        action: "liquidity:skip",
        details: { reason: "No tokenB configured" },
      };
    }

    try {
      // Get current price via swap client quote
      const price = await context.swapClient.getPrice(
        tokenA as string,
        tokenB as string,
      );

      // Analyze balance
      const balance = await context.walletService.getBalance(context.walletId);
      const tokenBalances = await context.walletService.getTokenBalances(
        context.walletId,
      );

      const tokenBBalance = tokenBalances.find((t) => t.mint === tokenB);

      return {
        success: true,
        action: "liquidity:analyzed",
        details: {
          tokenA,
          tokenB,
          currentPrice: price,
          solBalance: balance.sol,
          tokenBBalance: tokenBBalance?.uiAmount || 0,
          recommendation:
            price > 0
              ? "Monitor pool for entry"
              : "No price data — pair may not have liquidity",
          maxSlippage,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        action: "liquidity:error",
        details: { error: error.message },
      };
    }
  }
}
