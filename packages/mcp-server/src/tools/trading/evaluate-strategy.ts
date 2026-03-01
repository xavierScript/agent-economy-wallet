/**
 * tools/trading/evaluate-strategy.ts
 *
 * MCP tool — evaluate a trading strategy and get a BUY / SELL / HOLD signal.
 *
 * The agent provides:
 *   - strategy name ("threshold-rebalance" or "sma-crossover")
 *   - current token prices (from fetch_prices)
 *   - current wallet balances (from get_balance)
 *   - optional strategy parameters
 *
 * The tool runs the strategy logic and returns a signal with reasoning.
 * The agent then decides whether to act on the signal by calling swap_tokens.
 *
 * State management: SMA crossover requires price history across ticks.
 * We maintain per-wallet strategy state in memory so agents can call
 * evaluate_strategy repeatedly and get correct crossover detection.
 */

import { z } from "zod";
import { WELL_KNOWN_TOKENS } from "@agentic-wallet/core";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WalletServices } from "../../services.js";

// ── Well-known mints ─────────────────────────────────────────────────────────

const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

// ── Strategy state (in-memory, per wallet) ───────────────────────────────────

interface SmaState {
  priceHistory: number[];
  prevFastAboveSlow: boolean | null;
}

/** Keyed by walletId — persists across evaluate_strategy calls within the same server session. */
const smaStateMap = new Map<string, SmaState>();

// ── Strategy evaluation logic ────────────────────────────────────────────────

interface Signal {
  action: "BUY" | "SELL" | "HOLD";
  inputToken: string;
  outputToken: string;
  amount: number;
  reason: string;
}

function evaluateThresholdRebalance(
  solPriceUsd: number,
  usdcPriceUsd: number,
  solBalance: number,
  usdcBalance: number,
  targetAllocation: number,
  driftThreshold: number,
): Signal {
  const baseValueUsd = solBalance * solPriceUsd;
  const quoteValueUsd = usdcBalance * usdcPriceUsd;
  const totalUsd = baseValueUsd + quoteValueUsd;

  if (totalUsd === 0) {
    return {
      action: "HOLD",
      inputToken: "SOL",
      outputToken: "USDC",
      amount: 0,
      reason: "Portfolio is empty — nothing to rebalance",
    };
  }

  const currentAllocation = baseValueUsd / totalUsd;
  const drift = currentAllocation - targetAllocation;
  const targetPct = (targetAllocation * 100).toFixed(0);
  const currentPct = (currentAllocation * 100).toFixed(1);
  const driftPct = (driftThreshold * 100).toFixed(0);

  if (Math.abs(drift) <= driftThreshold) {
    return {
      action: "HOLD",
      inputToken: "SOL",
      outputToken: "USDC",
      amount: 0,
      reason: `SOL allocation ${currentPct}% is within ±${driftPct}% of target ${targetPct}%`,
    };
  }

  if (drift > 0) {
    // Over-allocated in SOL → sell SOL for USDC
    const excessUsd = drift * totalUsd;
    const sellAmount = parseFloat((excessUsd / solPriceUsd).toFixed(6));
    return {
      action: "SELL",
      inputToken: "SOL",
      outputToken: "USDC",
      amount: sellAmount,
      reason:
        `SOL over-allocated at ${currentPct}% (target ${targetPct}%). ` +
        `Sell ${sellAmount} SOL (~$${excessUsd.toFixed(2)}) to rebalance.`,
    };
  } else {
    // Under-allocated in SOL → buy SOL with USDC
    const deficitUsd = Math.abs(drift) * totalUsd;
    const buyAmountUsdc = parseFloat((deficitUsd / usdcPriceUsd).toFixed(2));
    return {
      action: "BUY",
      inputToken: "USDC",
      outputToken: "SOL",
      amount: buyAmountUsdc,
      reason:
        `SOL under-allocated at ${currentPct}% (target ${targetPct}%). ` +
        `Buy SOL with ${buyAmountUsdc} USDC (~$${deficitUsd.toFixed(2)}) to rebalance.`,
    };
  }
}

function evaluateSmaCrossover(
  walletId: string,
  solPriceUsd: number,
  solBalance: number,
  usdcBalance: number,
  fastWindow: number,
  slowWindow: number,
  tradeFraction: number,
): Signal {
  // Get or create state for this wallet
  let state = smaStateMap.get(walletId);
  if (!state) {
    state = { priceHistory: [], prevFastAboveSlow: null };
    smaStateMap.set(walletId, state);
  }

  if (solPriceUsd === 0) {
    return {
      action: "HOLD",
      inputToken: "SOL",
      outputToken: "USDC",
      amount: 0,
      reason: "No price data available for SOL",
    };
  }

  // Record price
  state.priceHistory.push(solPriceUsd);
  const maxHistory = slowWindow + 1;
  if (state.priceHistory.length > maxHistory) {
    state.priceHistory = state.priceHistory.slice(-maxHistory);
  }

  // Need enough data for slow MA
  if (state.priceHistory.length < slowWindow) {
    return {
      action: "HOLD",
      inputToken: "SOL",
      outputToken: "USDC",
      amount: 0,
      reason: `Collecting price data: ${state.priceHistory.length}/${slowWindow} ticks needed for slow MA`,
    };
  }

  // Calculate MAs
  const sma = (data: number[], window: number): number => {
    const slice = data.slice(-window);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  };

  const fastMA = sma(state.priceHistory, fastWindow);
  const slowMA = sma(state.priceHistory, slowWindow);
  const fastAboveSlow = fastMA > slowMA;

  const prevFastAboveSlow = state.prevFastAboveSlow;
  state.prevFastAboveSlow = fastAboveSlow;

  if (prevFastAboveSlow === null) {
    return {
      action: "HOLD",
      inputToken: "SOL",
      outputToken: "USDC",
      amount: 0,
      reason: `Initializing crossover detection: fast MA $${fastMA.toFixed(2)}, slow MA $${slowMA.toFixed(2)}`,
    };
  }

  if (fastAboveSlow === prevFastAboveSlow) {
    const trend = fastAboveSlow ? "bullish" : "bearish";
    return {
      action: "HOLD",
      inputToken: "SOL",
      outputToken: "USDC",
      amount: 0,
      reason:
        `No crossover — trend is ${trend} (fast MA $${fastMA.toFixed(2)} ` +
        `${fastAboveSlow ? ">" : "<"} slow MA $${slowMA.toFixed(2)})`,
    };
  }

  // Crossover detected
  if (fastAboveSlow && !prevFastAboveSlow) {
    // Golden cross → BUY SOL with a fraction of USDC
    const tradeAmount = parseFloat((usdcBalance * tradeFraction).toFixed(2));
    if (tradeAmount <= 0) {
      return {
        action: "HOLD",
        inputToken: "USDC",
        outputToken: "SOL",
        amount: 0,
        reason: `Golden cross detected but insufficient USDC balance (${usdcBalance})`,
      };
    }
    return {
      action: "BUY",
      inputToken: "USDC",
      outputToken: "SOL",
      amount: tradeAmount,
      reason:
        `Golden cross: fast MA ($${fastMA.toFixed(2)}) crossed above slow MA ($${slowMA.toFixed(2)}). ` +
        `Buy SOL with ${tradeFraction * 100}% of USDC balance (${tradeAmount} USDC).`,
    };
  } else {
    // Death cross → SELL a fraction of SOL
    const tradeAmount = parseFloat((solBalance * tradeFraction).toFixed(6));
    if (tradeAmount <= 0) {
      return {
        action: "HOLD",
        inputToken: "SOL",
        outputToken: "USDC",
        amount: 0,
        reason: `Death cross detected but insufficient SOL balance (${solBalance})`,
      };
    }
    return {
      action: "SELL",
      inputToken: "SOL",
      outputToken: "USDC",
      amount: tradeAmount,
      reason:
        `Death cross: fast MA ($${fastMA.toFixed(2)}) crossed below slow MA ($${slowMA.toFixed(2)}). ` +
        `Sell ${tradeFraction * 100}% of SOL balance (${tradeAmount} SOL).`,
    };
  }
}

// ── MCP Tool Registration ────────────────────────────────────────────────────

export function registerEvaluateStrategyTool(
  server: McpServer,
  _services: WalletServices,
) {
  server.registerTool(
    "evaluate_strategy",
    {
      title: "Evaluate Trading Strategy",
      description:
        "Evaluate a trading strategy and get a BUY, SELL, or HOLD signal with reasoning. " +
        "Strategies: 'threshold-rebalance' (maintain target SOL/USDC allocation) or " +
        "'sma-crossover' (simple moving average momentum). " +
        "Call fetch_prices and get_balance first, then pass the data here. " +
        "If the signal is BUY or SELL, use swap_tokens to execute the trade.",
      inputSchema: {
        strategy: z
          .enum(["threshold-rebalance", "sma-crossover"])
          .describe("Strategy to evaluate"),
        wallet_id: z
          .string()
          .describe(
            "Wallet ID — used to track SMA state across ticks for sma-crossover",
          ),
        sol_price_usd: z
          .number()
          .positive()
          .describe("Current SOL price in USD (from fetch_prices)"),
        sol_balance: z
          .number()
          .min(0)
          .describe("Current SOL balance (from get_balance)"),
        usdc_balance: z
          .number()
          .min(0)
          .describe("Current USDC balance (from get_balance)"),
        // Threshold rebalance params
        target_allocation: z
          .number()
          .min(0)
          .max(1)
          .optional()
          .default(0.7)
          .describe(
            "Target SOL allocation 0–1 (e.g. 0.7 = 70% SOL). Default: 0.7. " +
              "Only used by threshold-rebalance.",
          ),
        drift_threshold: z
          .number()
          .min(0)
          .max(1)
          .optional()
          .default(0.05)
          .describe(
            "Drift threshold before rebalancing 0–1 (e.g. 0.05 = 5%). Default: 0.05. " +
              "Only used by threshold-rebalance.",
          ),
        // SMA params
        fast_window: z
          .number()
          .int()
          .min(2)
          .optional()
          .default(5)
          .describe(
            "Fast SMA window in ticks. Default: 5. Only used by sma-crossover.",
          ),
        slow_window: z
          .number()
          .int()
          .min(3)
          .optional()
          .default(20)
          .describe(
            "Slow SMA window in ticks. Default: 20. Only used by sma-crossover.",
          ),
        trade_fraction: z
          .number()
          .min(0)
          .max(1)
          .optional()
          .default(0.2)
          .describe(
            "Fraction of balance to trade per signal 0–1. Default: 0.2 (20%). " +
              "Only used by sma-crossover.",
          ),
      },
      annotations: {
        title: "Evaluate Trading Strategy",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false, // SMA state mutates on each call
        openWorldHint: false,
      },
    },
    async ({
      strategy,
      wallet_id,
      sol_price_usd,
      sol_balance,
      usdc_balance,
      target_allocation,
      drift_threshold,
      fast_window,
      slow_window,
      trade_fraction,
    }) => {
      let signal: Signal;

      if (strategy === "threshold-rebalance") {
        signal = evaluateThresholdRebalance(
          sol_price_usd,
          1.0, // USDC ≈ $1
          sol_balance,
          usdc_balance,
          target_allocation,
          drift_threshold,
        );
      } else {
        signal = evaluateSmaCrossover(
          wallet_id,
          sol_price_usd,
          sol_balance,
          usdc_balance,
          fast_window,
          slow_window,
          trade_fraction,
        );
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                strategy,
                walletId: wallet_id,
                signal: {
                  action: signal.action,
                  inputToken: signal.inputToken,
                  outputToken: signal.outputToken,
                  amount: signal.amount,
                  reason: signal.reason,
                },
                context: {
                  solPriceUsd: sol_price_usd,
                  solBalance: sol_balance,
                  usdcBalance: usdc_balance,
                },
                ...(strategy === "threshold-rebalance"
                  ? {
                      params: {
                        targetAllocation: target_allocation,
                        driftThreshold: drift_threshold,
                      },
                    }
                  : {
                      params: {
                        fastWindow: fast_window,
                        slowWindow: slow_window,
                        tradeFraction: trade_fraction,
                      },
                    }),
                nextStep:
                  signal.action === "HOLD"
                    ? "Wait and call fetch_prices + evaluate_strategy again on the next tick."
                    : `Execute: call swap_tokens with wallet_id="${wallet_id}", ` +
                      `input_token="${signal.inputToken}", output_token="${signal.outputToken}", ` +
                      `amount=${signal.amount}`,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
