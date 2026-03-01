/**
 * tools/create-wallet.ts
 *
 * MCP tool – create a new Solana wallet with encrypted key storage.
 */

import { z } from "zod";
import { PolicyEngine } from "@agentic-wallet/core";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WalletServices } from "../../services.js";

export function registerCreateWalletTool(
  server: McpServer,
  services: WalletServices,
) {
  const { config, walletService } = services;

  server.registerTool(
    "create_wallet",
    {
      title: "Create Wallet",
      description:
        "Create a new Solana wallet with AES-256-GCM encrypted key storage. " +
        "Returns the wallet ID and public key. The devnet safety policy " +
        "(2 SOL per-tx limit, 10 tx/hr rate limit, 10 SOL daily cap) is " +
        "always attached — agents cannot create policy-free wallets.",
      inputSchema: {
        label: z
          .string()
          .optional()
          .default("agent-wallet")
          .describe("Human-readable label for the wallet"),
      },
      annotations: {
        title: "Create Wallet",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ label }) => {
      const policy = PolicyEngine.createDevnetPolicy();
      const wallet = await walletService.createWallet(label, policy);

      const fundTxSignature = wallet.metadata.fundTxSignature as
        | string
        | undefined;
      const funded = wallet.balanceSol > 0;

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                id: wallet.id,
                label: wallet.label,
                publicKey: wallet.publicKey,
                cluster: config.cluster,
                policyAttached: true,
                funded,
                ...(funded
                  ? {
                      seedSol: wallet.balanceSol,
                      fundTxSignature,
                      fundExplorer: `https://explorer.solana.com/tx/${fundTxSignature}?cluster=${config.cluster}`,
                    }
                  : {
                      note: "No master wallet configured. Fund manually or set MASTER_WALLET_SECRET_KEY.",
                    }),
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
