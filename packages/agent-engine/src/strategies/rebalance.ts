import type {
  IAgentStrategy,
  StrategyContext,
  StrategyResult,
} from "./base.js";

/**
 * Portfolio Rebalance Strategy.
 *
 * Monitors target allocations and rebalances when drift exceeds threshold.
 *
 * Config:
 * - targets: Array of { mint: string, targetWeight: number } (weights sum to 1.0)
 * - driftThreshold: Rebalance when allocation drifts by this % (default 5%)
 * - intervalMs: Minimum time between checks
 */
export class RebalanceStrategy implements IAgentStrategy {
  readonly name = "rebalance";
  readonly description =
    "Portfolio rebalancing - maintain target token allocations";

  private lastCheckTime = 0;

  async execute(context: StrategyContext): Promise<StrategyResult> {
    const {
      targets = [],
      driftThreshold = 5,
      intervalMs = 120_000,
    } = context.config as Record<string, any>;

    const now = Date.now();
    if (now - this.lastCheckTime < Number(intervalMs)) {
      return {
        success: true,
        action: "rebalance:waiting",
        details: {
          nextCheckAt: new Date(
            this.lastCheckTime + Number(intervalMs),
          ).toISOString(),
        },
      };
    }

    this.lastCheckTime = now;

    try {
      // Get current balances
      const publicKey = context.walletService.getPublicKey(context.walletId);
      const balance = await context.walletService.getBalance(context.walletId);
      const tokenBalances = await context.walletService.getTokenBalances(
        context.walletId,
      );

      // Calculate current portfolio value in SOL
      const SOL_MINT = "So11111111111111111111111111111111111111112";
      const portfolio: Record<string, { value: number; targetWeight: number }> =
        {};

      let totalValue = balance.sol;
      portfolio[SOL_MINT] = { value: balance.sol, targetWeight: 0 };

      for (const target of targets as Array<{
        mint: string;
        targetWeight: number;
      }>) {
        const tokenBalance = tokenBalances.find(
          (tb) => tb.mint === target.mint,
        );
        if (tokenBalance && target.mint !== SOL_MINT) {
          // Estimate value in SOL
          const price = await context.swapClient.getPrice(
            target.mint,
            SOL_MINT,
            Math.floor(tokenBalance.uiAmount),
          );
          const valueInSol = tokenBalance.uiAmount * price;
          totalValue += valueInSol;
          portfolio[target.mint] = {
            value: valueInSol,
            targetWeight: target.targetWeight,
          };
        } else {
          portfolio[target.mint] = {
            value: target.mint === SOL_MINT ? balance.sol : 0,
            targetWeight: target.targetWeight,
          };
        }
      }

      // Find drifts
      const drifts: Array<{
        mint: string;
        currentPct: number;
        targetPct: number;
        driftPct: number;
      }> = [];
      for (const [mint, info] of Object.entries(portfolio)) {
        if (info.targetWeight === 0) continue;
        const currentPct = totalValue > 0 ? (info.value / totalValue) * 100 : 0;
        const targetPct = info.targetWeight * 100;
        const drift = Math.abs(currentPct - targetPct);
        drifts.push({ mint, currentPct, targetPct, driftPct: drift });
      }

      const needsRebalance = drifts.some(
        (d) => d.driftPct > Number(driftThreshold),
      );

      if (!needsRebalance) {
        return {
          success: true,
          action: "rebalance:balanced",
          details: {
            totalValue,
            drifts,
            message: "Portfolio within drift threshold",
          },
        };
      }

      // Execute rebalance: sell over-allocated, buy under-allocated
      const results: string[] = [];
      for (const drift of drifts) {
        if (drift.currentPct > drift.targetPct + Number(driftThreshold)) {
          // Over-allocated: sell some
          const excessPct = (drift.currentPct - drift.targetPct) / 100;
          const excessValue = excessPct * totalValue;
          // Swap excess to SOL (simplified — real impl would be smarter)
          if (drift.mint !== SOL_MINT) {
            results.push(
              `Would sell ${excessValue.toFixed(4)} SOL worth of ${drift.mint}`,
            );
          }
        } else if (
          drift.currentPct <
          drift.targetPct - Number(driftThreshold)
        ) {
          // Under-allocated: buy some
          const deficitPct = (drift.targetPct - drift.currentPct) / 100;
          const deficitValue = deficitPct * totalValue;
          if (drift.mint !== SOL_MINT) {
            results.push(
              `Would buy ${deficitValue.toFixed(4)} SOL worth of ${drift.mint}`,
            );
          }
        }
      }

      return {
        success: true,
        action: "rebalance:analyzed",
        details: { totalValue, drifts, rebalanceActions: results },
      };
    } catch (error: any) {
      return {
        success: false,
        action: "rebalance:error",
        details: { error: error.message },
      };
    }
  }
}
