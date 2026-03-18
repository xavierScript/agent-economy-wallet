import express, { Request, Response, NextFunction } from "express";
import { PublicKey } from "@solana/web3.js";
import { getMint } from "@solana/spl-token";
import type { WalletServices } from "../services.js";
import { WELL_KNOWN_TOKENS } from "@agent-economy-wallet/core";

export function createExpressApp(services: WalletServices): express.Express {
  const app = express();

  app.use(express.json());

  // Helper middleware to check for X-Receipt-Signature and verify payment
  const x402Paywall = (priceRaw: number, mintAddress: string) => {
    return async (req: Request, res: Response, next: NextFunction) => {
      const merchantAddress = services.config.merchantReceiverAddress;

      if (!merchantAddress) {
        return res
          .status(500)
          .json({ error: "Merchant receiver address not configured" });
      }

      const receiptSignature = req.header("x-receipt-signature");

      if (!receiptSignature) {
        const paymentRequired = {
          x402Version: 1,
          accepts: [
            {
              scheme: "exact",
              network: "solana-devnet",
              amount: priceRaw.toString(),
              asset: mintAddress,
              payTo: merchantAddress,
              maxTimeoutSeconds: 3600,
              extra: { feePayer: "" },
            },
          ],
        };

        res.setHeader(
          "X-PAYMENT-REQUIRED",
          Buffer.from(JSON.stringify(paymentRequired)).toString("base64"),
        );

        return res.status(402).json({
          error: "Payment Required",
          payment: {
            cluster: "devnet",
            mint: mintAddress,
            amount: priceRaw,
            recipient: merchantAddress,
          },
        });
      }

      try {
        await services.x402Server.verifyPayment(
          receiptSignature,
          priceRaw,
          mintAddress,
          merchantAddress,
        );
        next();
      } catch (error: any) {
        return res.status(400).json({
          error: "Payment verification failed",
          details: error.message,
        });
      }
    };
  };

  const USDC_MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

  // Endpoint 1: GET /api/analyze-token/:mint
  app.get(
    "/api/analyze-token/:mint",
    x402Paywall(100_000, USDC_MINT), // 0.1 USDC
    async (req: Request, res: Response) => {
      try {
        const { mint } = req.params;
        const mintPubkey = new PublicKey(mint);
        const mintInfo = await getMint(
          services.connection.getConnection(),
          mintPubkey,
        );

        return res.json({
          mintAddress: mint,
          mintAuthority: mintInfo.mintAuthority
            ? mintInfo.mintAuthority.toBase58()
            : null,
          freezeAuthority: mintInfo.freezeAuthority
            ? mintInfo.freezeAuthority.toBase58()
            : null,
          supply: mintInfo.supply.toString(),
          decimals: mintInfo.decimals,
          isInitialized: mintInfo.isInitialized,
          securityAssessment: {
            hasMintAuthority: mintInfo.mintAuthority !== null,
            hasFreezeAuthority: mintInfo.freezeAuthority !== null,
            riskLevel:
              mintInfo.mintAuthority !== null ||
              mintInfo.freezeAuthority !== null
                ? "MEDIUM/HIGH"
                : "LOW",
            description:
              "Tokens with active mint or freeze authorities pose centralisation risks.",
          },
        });
      } catch (error: any) {
        return res.status(500).json({ error: error.message });
      }
    },
  );

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

  // Endpoint 2: GET /api/fetch-price/:mint
  app.get(
    "/api/fetch-price/:mint",
    x402Paywall(50_000, USDC_MINT), // 0.05 USDC
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
        return res.status(500).json({ error: error.message });
      }
    },
  );

  return app;
}
