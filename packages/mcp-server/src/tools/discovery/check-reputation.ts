/**
 * tools/discovery/check-reputation.ts
 *
 * MCP tool — check a merchant's reputation before spending.
 *
 * Supports two lookup modes:
 *   1. **On-chain** (preferred): reads the merchant's reputation PDA
 *      from the agent-reputation Anchor program. Requires only the
 *      merchant's Solana address.
 *   2. **HTTP fallback**: fetches from a reputation endpoint URL.
 *      Used for legacy/non-PDA merchants.
 *
 * Use this after `discover_registry` to evaluate whether a merchant
 * is trustworthy before committing funds.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WalletServices } from "../../services.js";
import { fetchMerchantReputation } from "@agent-economy-wallet/core";
import { PublicKey } from "@solana/web3.js";

export function registerCheckReputationTool(
  server: McpServer,
  services: WalletServices,
) {
  server.registerTool(
    "check_reputation",
    {
      title: "Check Merchant Reputation",
      description:
        "Check a merchant agent's reputation and trust signals before making a payment. " +
        "Provide a merchant wallet address for on-chain PDA lookup, or a reputation URL as fallback. " +
        "Returns total transactions, success rate, total volume, trust score, and unique buyer data. " +
        "Use this to make an informed trust decision before spending.",
      inputSchema: {
        merchant_address: z
          .string()
          .optional()
          .describe(
            "Merchant's Solana wallet address (base58). Used for on-chain reputation PDA lookup.",
          ),
        reputation_url: z
          .string()
          .url()
          .optional()
          .describe(
            "Full URL to the merchant's reputation endpoint (legacy fallback). " +
            "Used when merchant_address is not available.",
          ),
      },
      annotations: {
        title: "Check Merchant Reputation",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ merchant_address, reputation_url }) => {
      // ── On-chain PDA lookup (preferred) ─────────────────────────────
      if (merchant_address) {
        try {
          const programId = services.config.reputationProgramId
            ? new PublicKey(services.config.reputationProgramId)
            : undefined;

          const reputation = await fetchMerchantReputation(
            services.connection.getConnection(),
            merchant_address,
            programId
          );

          services.auditLogger.log({
            action: "reputation:check:onchain",
            success: true,
            details: {
              merchant: merchant_address,
              exists: reputation.exists,
              trustScore: reputation.trustScore,
              totalPayments: reputation.totalPayments,
            },
          });

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    source: "on-chain PDA",
                    merchant: merchant_address,
                    exists: reputation.exists,
                    trust_score: reputation.trustScore,
                    total_payments: reputation.totalPayments,
                    total_volume_usdc: reputation.totalVolumeDisplay,
                    unique_buyers: reputation.uniqueBuyers,
                    last_payment: reputation.lastPaymentTs
                      ? new Date(
                          reputation.lastPaymentTs * 1000,
                        ).toISOString()
                      : null,
                    assessment: reputation.exists
                      ? reputation.trustScore >= 80
                        ? "HIGH TRUST — Established merchant with significant history"
                        : reputation.trustScore >= 50
                          ? "MEDIUM TRUST — Growing merchant with some history"
                          : reputation.trustScore >= 20
                            ? "LOW TRUST — New merchant, proceed with caution"
                            : "VERY LOW TRUST — Minimal history, high caution recommended"
                      : "NO ON-CHAIN HISTORY — This merchant has no recorded payments yet",
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        } catch (err: any) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error reading on-chain reputation: ${err.message}`,
              },
            ],
            isError: true,
          };
        }
      }

      // ── HTTP fallback ───────────────────────────────────────────────
      if (reputation_url) {
        try {
          const resp = await fetch(reputation_url, {
            signal: AbortSignal.timeout(10000),
          });

          if (!resp.ok) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Error: Reputation endpoint returned HTTP ${resp.status} ${resp.statusText}`,
                },
              ],
              isError: true,
            };
          }

          const reputation = (await resp.json()) as Record<string, unknown>;

          services.auditLogger.log({
            action: "reputation:check:http",
            success: true,
            details: { reputation_url },
          });

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    source: "HTTP endpoint",
                    reputation_url,
                    ...reputation,
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        } catch (err: any) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error checking reputation: ${err.message}`,
              },
            ],
            isError: true,
          };
        }
      }

      // ── Neither provided ────────────────────────────────────────────
      return {
        content: [
          {
            type: "text" as const,
            text: "Error: Provide either a merchant_address (for on-chain lookup) or a reputation_url (for HTTP fallback).",
          },
        ],
        isError: true,
      };
    },
  );
}
