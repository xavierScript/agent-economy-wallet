import { Express, Request, Response } from "express";
import { PublicKey } from "@solana/web3.js";
import { getMint } from "@solana/spl-token";
import type { WalletServices } from "../../../services.js";
import { createX402Paywall } from "../../middleware/x402-paywall.js";
import { USDC_MINT } from "../../helpers.js";

/**
 * Endpoint 1: GET /api/analyze-token/:mint
 */
export function registerAnalyzeTokenRoute(
  app: Express,
  services: WalletServices,
) {
  const x402Paywall = createX402Paywall(services, 100_000, USDC_MINT); // 0.1 USDC

  app.get(
    "/api/analyze-token/:mint",
    x402Paywall,
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
        return res.status(400).json({ error: error.message });
      }
    },
  );
}
