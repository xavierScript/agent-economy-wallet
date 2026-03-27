/**
 * tools/discovery/discover-registry.ts
 *
 * MCP tool — discover all registered agent merchants from the on-chain
 * Solana registry (SPL Memo-based, fully decentralised).
 *
 * The registry lives entirely on-chain. No databases, no central servers.
 * This tool scans memo transactions involving the known registry wallet
 * address, parses valid agent registration memos, verifies each manifest
 * URL is still live, and returns the list of active merchants.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WalletServices } from "../../services.js";
import { discoverRegistry } from "@agent-economy-wallet/core";

export function registerDiscoverRegistryTool(
  server: McpServer,
  services: WalletServices,
) {
  server.registerTool(
    "discover_registry",
    {
      title: "Discover Agent Registry",
      description:
        "Discover all registered agent merchants from the decentralised on-chain registry. " +
        "Scans SPL Memo transactions on Solana involving the registry wallet address, " +
        "parses valid agent registration memos, fetches each manifest URL to verify " +
        "the merchant is still live, and returns all active merchants with their services " +
        "and pricing. No input needed — the registry wallet address is built-in. " +
        "Use this as the first step when looking for services to buy.",
      inputSchema: {
        limit: z
          .number()
          .int()
          .positive()
          .max(200)
          .optional()
          .describe(
            "Max number of on-chain transactions to scan (default 100). Higher = more thorough but slower.",
          ),
      },
      annotations: {
        title: "Discover Agent Registry",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ limit }) => {
      try {
        const conn = services.connection.getConnection();
        const agents = await discoverRegistry(conn, limit ?? 100);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  registry: "on-chain (Solana SPL Memo)",
                  total_agents: agents.length,
                  agents,
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
              text: `Error discovering registry: ${err.message}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
