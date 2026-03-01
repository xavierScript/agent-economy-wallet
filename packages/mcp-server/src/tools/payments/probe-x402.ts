/**
 * tools/payments/probe-x402.ts
 *
 * MCP tool – check if a URL requires x402 payment without paying.
 *
 * Useful for agents to discover pricing before committing funds.
 * Makes a HEAD request and parses the 402 Payment Required response.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WalletServices } from "../../services.js";
import { X402Client } from "@agentic-wallet/core";

export function registerProbeX402Tool(
  server: McpServer,
  services: WalletServices,
) {
  const { x402Client } = services;

  server.registerTool(
    "probe_x402",
    {
      title: "Probe x402 Resource",
      description:
        "Check whether a URL requires x402 payment and what the payment options are, " +
        "without actually making a payment. Returns payment requirements including " +
        "price, accepted tokens, and network details. Useful for cost discovery " +
        "before committing funds.",
      inputSchema: {
        url: z
          .string()
          .url()
          .describe("URL to check for x402 payment requirements"),
      },
      annotations: {
        title: "Probe x402 Resource",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ url }) => {
      try {
        const probe = await x402Client.probeResource(url);

        if (!probe.requiresPayment) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    url,
                    requiresPayment: false,
                    message: "This URL does not require x402 payment.",
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        const svmOptions = probe.svmOptions?.map((opt) => ({
          scheme: opt.scheme,
          network: opt.network,
          amount: opt.amount,
          formattedAmount: X402Client.formatAmount(opt.amount, opt.asset),
          asset: opt.asset,
          payTo: opt.payTo,
          maxTimeoutSeconds: opt.maxTimeoutSeconds,
          feePayer: opt.extra?.feePayer,
          description: opt.description,
        }));

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  url,
                  requiresPayment: true,
                  svmOptionsCount: svmOptions?.length || 0,
                  svmOptions: svmOptions || [],
                  allOptions:
                    probe.paymentRequired?.accepts.map((a) => ({
                      scheme: a.scheme,
                      network: a.network,
                      amount: a.amount,
                      asset: a.asset,
                    })) || [],
                  x402Version: probe.paymentRequired?.x402Version,
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
              text: `Error probing resource: ${err.message}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
