/**
 * resources/trading/trading-strategies.ts
 *
 * MCP resource — lists available trading strategies and their descriptions.
 * AI agents can read this to discover what strategies are available
 * before calling evaluate_strategy.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WalletServices } from "../../services.js";

export function registerTradingStrategiesResource(
  server: McpServer,
  _services: WalletServices,
) {
  server.registerResource(
    "trading-strategies",
    "trading://strategies",
    {
      title: "Trading Strategies",
      description:
        "Lists all available trading strategies that can be used with the " +
        "evaluate_strategy tool, including their parameters and defaults.",
      mimeType: "application/json",
    },
    async () => {
      return {
        contents: [
          {
            uri: "trading://strategies",
            text: JSON.stringify(
              {
                strategies: [
                  {
                    name: "threshold-rebalance",
                    description:
                      "Maintains a target allocation between SOL and USDC. " +
                      "When the portfolio drifts beyond a configurable threshold, " +
                      "signals a trade to rebalance back to the target.",
                    parameters: {
                      target_allocation: {
                        type: "number",
                        default: 0.7,
                        description:
                          "Target SOL allocation (0–1). 0.7 = 70% SOL / 30% USDC.",
                      },
                      drift_threshold: {
                        type: "number",
                        default: 0.05,
                        description:
                          "Drift threshold before rebalancing (0–1). 0.05 = 5%.",
                      },
                    },
                    example_profiles: [
                      {
                        name: "conservative",
                        target_allocation: 0.8,
                        drift_threshold: 0.1,
                        description: "80/20 split, wide tolerance",
                      },
                      {
                        name: "balanced",
                        target_allocation: 0.7,
                        drift_threshold: 0.05,
                        description: "70/30 split, moderate tolerance",
                      },
                      {
                        name: "aggressive",
                        target_allocation: 0.5,
                        drift_threshold: 0.03,
                        description:
                          "50/50 split, tight tolerance — trades frequently",
                      },
                    ],
                  },
                  {
                    name: "sma-crossover",
                    description:
                      "Tracks fast and slow simple moving averages (SMA) of SOL price. " +
                      "Golden cross (fast crosses above slow) → BUY signal. " +
                      "Death cross (fast crosses below slow) → SELL signal. " +
                      "Requires multiple ticks to build history before generating signals.",
                    parameters: {
                      fast_window: {
                        type: "integer",
                        default: 5,
                        description: "Fast SMA window in ticks.",
                      },
                      slow_window: {
                        type: "integer",
                        default: 20,
                        description: "Slow SMA window in ticks.",
                      },
                      trade_fraction: {
                        type: "number",
                        default: 0.2,
                        description:
                          "Fraction of balance to trade per signal (0–1). 0.2 = 20%.",
                      },
                    },
                    note:
                      "SMA state is maintained per-wallet across evaluate_strategy calls " +
                      "within the same server session. Call evaluate_strategy repeatedly " +
                      "to build up price history and detect crossovers.",
                  },
                ],
                usage: {
                  workflow: [
                    "1. Read trading://strategies to discover available strategies",
                    "2. Call fetch_prices to get current token prices",
                    "3. Call get_balance to get wallet balances",
                    "4. Call evaluate_strategy with prices, balances, and strategy name",
                    "5. If signal is BUY or SELL, call swap_tokens to execute",
                    "6. Repeat steps 2–5 for each tick of autonomous trading",
                  ],
                  tools_used: [
                    "fetch_prices",
                    "evaluate_strategy",
                    "get_balance",
                    "swap_tokens",
                  ],
                },
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
