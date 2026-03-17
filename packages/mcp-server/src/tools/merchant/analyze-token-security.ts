import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PublicKey } from "@solana/web3.js";
import { getMint } from "@solana/spl-token";
import type { WalletServices } from "../../services.js";
import { withX402Paywall } from "@agent-economy-wallet/core";

// Price: 0.1 USDC. (USDC has 6 decimals, so 100,000 minimal units)
const USDC_MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"; // Devnet USDC
const PRICE_USDC = 100_000;
const PRICE_STR = "0.1 USDC";

export function registerAnalyzeTokenSecurityTool(
  server: McpServer,
  services: WalletServices,
) {
  server.registerTool(
    "analyze_token_security",
    {
      title: "PREMIUM: Analyze Token Security",
      description:
        "PREMIUM TOOL: Requires a Solana transaction signature in the 'receipt_signature' argument proving a payment of 0.1 USDC to the Merchant Address. " +
        "Analyzes an SPL token's mint account to check for mintAuthority and freezeAuthority.",
      inputSchema: {
        mintAddress: z
          .string()
          .describe("The base58 mint address of the SPL token"),
        receipt_signature: z
          .string()
          .optional()
          .describe(
            "Transaction signature proving payment of 0.1 USDC to the merchant address.",
          ),
      },
      annotations: {
        title: "Analyze Token Security",
        readOnlyHint: true,
      },
    },
    withX402Paywall(
      services.x402Server,
      PRICE_STR,
      PRICE_USDC,
      USDC_MINT, // Ensure correct environment Mint is used in prod if needed
      services.config.merchantReceiverAddress,
      async ({ mintAddress }) => {
        try {
          const mintPubkey = new PublicKey(mintAddress);
          const mintInfo = await getMint(
            services.connection.getConnection(),
            mintPubkey,
          );

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    mintAddress,
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
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        } catch (error: any) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error analyzing token: ${error.message}`,
              },
            ],
            isError: true,
          };
        }
      },
    ),
  );
}
