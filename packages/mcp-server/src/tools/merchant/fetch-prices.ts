/**
 * tools/merchant/fetch-prices.ts
 *
 * MCP tool — fetch real-time token prices.
 * Source: CoinGecko free API (no key required).
 * This gives AI agents the market data they need to make autonomous trading decisions.
 *
 * Wrapped in x402 paywall.
 */

import { z } from "zod";
import { WELL_KNOWN_TOKENS, withX402Paywall } from "@agentic-wallet/core";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WalletServices } from "../../services.js";

const COINGECKO_PRICE_API = "https://api.coingecko.com/api/v3/simple/price";

// Price: 0.05 USDC
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const PRICE_USDC = 50_000;
const PRICE_STR = "0.05 USDC";

/** Maps mint address → CoinGecko coin ID */
const MINT_TO_COINGECKO_ID: Record<string, string> = {
  So11111111111111111111111111111111111111112: "solana",
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: "usd-coin",
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: "tether",
  DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263: "bonk",
  JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN: "jupiter-exchange-solana",
};

/** Resolve a symbol like "SOL" to its mint address. */
function resolveToMint(symbolOrMint: string): string {
  // If it looks like a base58 mint address (> 20 chars), pass through
  if (symbolOrMint.length > 20) return symbolOrMint;

  const upper = symbolOrMint.toUpperCase();
  for (const [mint, info] of Object.entries(WELL_KNOWN_TOKENS)) {
    if (info.symbol.toUpperCase() === upper) return mint;
  }
  throw new Error(
    `Unknown token symbol: ${symbolOrMint}. ` +
      `Known symbols: ${Object.values(WELL_KNOWN_TOKENS)
        .map((t) => t.symbol)
        .join(", ")}. ` +
      `You can also pass a mint address directly.`,
  );
}

export function registerFetchPricesTool(
  server: McpServer,
  services: WalletServices,
) {
  server.registerTool(
    "fetch_prices",
    {
      title: "PREMIUM: Fetch Token Prices",
      description:
        "PREMIUM TOOL: Requires a Solana transaction signature in the 'receipt_signature' argument proving a payment of 0.05 USDC to the Merchant Address. " +
        "Fetch real-time USD prices for one or more Solana tokens from the " +
        "CoinGecko API. Accepts token symbols (SOL, USDC, USDT, BONK, JUP) " +
        "or mint addresses. Use this before evaluating a trading strategy.",
      inputSchema: {
        tokens: z
          .string()
          .describe(
            "Comma-separated token symbols or mint addresses (e.g. 'SOL,USDC' or 'SOL,USDC,BONK')",
          ),
        receipt_signature: z
          .string()
          .optional()
          .describe(
            "Transaction signature proving payment of 0.05 USDC to the merchant address.",
          ),
      },
      annotations: {
        title: "Fetch Token Prices",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    withX402Paywall(
      services.x402Server,
      PRICE_STR,
      PRICE_USDC,
      USDC_MINT,
      services.config.merchantReceiverAddress,
      async ({ tokens }) => {
        // Parse and resolve tokens
        const tokenList = tokens
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t.length > 0);

        if (tokenList.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "Error: provide at least one token symbol or mint address.",
              },
            ],
            isError: true,
          };
        }

        let mints: string[];
        try {
          mints = tokenList.map(resolveToMint);
        } catch (err: any) {
          return {
            content: [{ type: "text" as const, text: `Error: ${err.message}` }],
            isError: true,
          };
        }

        const geckoIds = mints
          .map((m) => MINT_TO_COINGECKO_ID[m])
          .filter(Boolean);

        if (geckoIds.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "None of the requested tokens have a known CoinGecko mapping. Cannot fetch prices.",
              },
            ],
            isError: true,
          };
        }

        let prices: Array<{ symbol: string; mint: string; priceUsd: number }> =
          [];
        let source = "CoinGecko API";
        const now = new Date().toISOString();

        try {
          const params = new URLSearchParams({
            ids: geckoIds.join(","),
            vs_currencies: "usd",
          });
          const url = `${COINGECKO_PRICE_API}?${params.toString()}`;
          const response = await fetch(url);

          if (!response.ok) {
            const body = await response.text();
            return {
              content: [
                {
                  type: "text" as const,
                  text: `CoinGecko API failed (${response.status}): ${body}`,
                },
              ],
              isError: true,
            };
          }

          const json = (await response.json()) as Record<
            string,
            { usd: number }
          >;

          for (const mint of mints) {
            const geckoId = MINT_TO_COINGECKO_ID[mint];
            if (!geckoId || !json[geckoId]) continue;
            const known = WELL_KNOWN_TOKENS[mint];
            prices.push({
              symbol: known?.symbol ?? mint.slice(0, 8),
              mint,
              priceUsd: json[geckoId].usd,
            });
          }
        } catch (err: any) {
          return {
            content: [
              {
                type: "text" as const,
                text: `CoinGecko is unreachable: ${err.message}`,
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  timestamp: now,
                  prices,
                  source,
                },
                null,
                2,
              ),
            },
          ],
        };
      },
    ),
  );
}
