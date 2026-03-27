/**
 * tools/discovery/check-reputation.ts
 *
 * MCP tool — check a merchant's reputation before spending.
 *
 * Given a reputation URL, this tool fetches the merchant's trust signal
 * including total transactions, success rate, and total earned USDC.
 *
 * Use this after `discover_registry` to evaluate whether a merchant
 * is trustworthy before committing funds.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WalletServices } from "../../services.js";

export function registerCheckReputationTool(
  server: McpServer,
  _services: WalletServices,
) {
  server.registerTool(
    "check_reputation",
    {
      title: "Check Merchant Reputation",
      description:
        "Check a merchant agent's reputation and trust signals before making a payment. " +
        "Returns total transactions, success rate, total earned USDC, and uptime data. " +
        "Use this to make an informed trust decision before spending. " +
        "The reputation URL is typically found in the registry or manifest.",
      inputSchema: {
        reputation_url: z
          .string()
          .url()
          .describe(
            "Full URL to the merchant's reputation endpoint (e.g. https://example.com/reputation)",
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
    async ({ reputation_url }) => {
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

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
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
    },
  );
}
