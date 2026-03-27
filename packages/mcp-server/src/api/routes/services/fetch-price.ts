import { Express, Request, Response } from "express";
import { WELL_KNOWN_TOKENS } from "@agent-economy-wallet/core";
import type { WalletServices } from "../../../services.js";
import { createX402Paywall } from "../../middleware/x402-paywall.js";
import { USDC_MINT } from "../../helpers.js";

const COINGECKO_PRICE_API = "https://api.coingecko.com/api/v3/simple/price";
const MINT_TO_COINGECKO_ID: Record<string, string> = {
  So11111111111111111111111111111111111111112: "solana",
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU": "usd-coin",
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: "tether",
  DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263: "bonk",
  JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN: "jupiter-exchange-solana",
};

function resolveToMint(symbolOrMint: string): string {
  if (symbolOrMint.length > 20) return symbolOrMint;
  const upper = symbolOrMint.toUpperCase();
  for (const [mint, info] of Object.entries(WELL_KNOWN_TOKENS)) {
    if (info.symbol.toUpperCase() === upper) return mint;
  }
  throw new Error(`Unknown token symbol: ${symbolOrMint}`);
}

/**
 * Endpoint 2: GET /api/fetch-price/:mint
 */
export function registerFetchPriceRoute(
  app: Express,
  services: WalletServices,
) {
  const x402Paywall = createX402Paywall(services, 50_000, USDC_MINT); // 0.05 USDC

  app.get(
    "/api/fetch-price/:mint",
    x402Paywall,
    async (req: Request, res: Response) => {
      try {
        const tokenStr = String(req.params.mint);
        const mints = tokenStr
          .split(",")
          .map((s: string) => resolveToMint(s.trim()));

        const geckoIds = mints
          .map((m: string) => MINT_TO_COINGECKO_ID[m])
          .filter(Boolean);

        if (geckoIds.length === 0) {
          return res
            .status(400)
            .json({ error: "No CoinGecko mapping for provided tokens" });
        }

        const params = new URLSearchParams({
          ids: geckoIds.join(","),
          vs_currencies: "usd",
        });

        const url = `${COINGECKO_PRICE_API}?${params.toString()}`;
        const response = await fetch(url);

        if (!response.ok) {
          const body = await response.text();
          return res
            .status(502)
            .json({ error: `CoinGecko API failed: ${body}` });
        }

        const json = (await response.json()) as Record<string, { usd: number }>;
        const prices = [];

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

        return res.json({
          timestamp: new Date().toISOString(),
          prices,
          source: "CoinGecko API",
        });
      } catch (error: any) {
        return res.status(400).json({ error: error.message });
      }
    },
  );
}
