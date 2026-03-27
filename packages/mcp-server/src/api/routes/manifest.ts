import { Express, Request, Response } from "express";
import type { WalletServices } from "../../services.js";
import { getBaseUrl } from "../helpers.js";

/**
 * Service Manifest — machine-readable description of this merchant
 */
export function registerManifestRoute(app: Express, services: WalletServices) {
  app.get("/.well-known/agent.json", (req: Request, res: Response) => {
    const merchantAddress =
      services.config.merchantReceiverAddress ||
      services.config.ownerAddress ||
      "NOT_CONFIGURED";

    res.json({
      name: process.env.AGENT_NAME || "data",
      description:
        process.env.AGENT_DESCRIPTION ||
        "Real-time Solana token intelligence",
      version: "1.0.0",
      wallet: merchantAddress,
      x402: true,
      reputation_url: `${getBaseUrl(req)}/reputation`,
      services: [
        {
          id: "fetch-price",
          endpoint: "/api/fetch-price/:token",
          description: "Live token price via CoinGecko",
          payment: {
            amount: "0.05",
            token: "USDC",
            network: "solana-devnet",
          },
        },
        {
          id: "analyze-token",
          endpoint: "/api/analyze-token/:address",
          description: "Security rug-check and on-chain token analysis",
          payment: {
            amount: "0.1",
            token: "USDC",
            network: "solana-devnet",
          },
        },
      ],
    });
  });
}
