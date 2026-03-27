/**
 * tools/discovery/read-manifest.ts
 *
 * MCP tool — fetch and return a merchant's service manifest.
 *
 * Given a manifest URL (typically `/.well-known/agent.json`), this tool
 * fetches it and returns the full manifest including the merchant's name,
 * wallet address, available services, and pricing.
 *
 * Use this after `discover_registry` to inspect a specific merchant's
 * offerings before deciding to buy.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WalletServices } from "../../services.js";

export function registerReadManifestTool(
  server: McpServer,
  _services: WalletServices,
) {
  server.registerTool(
    "read_manifest",
    {
      title: "Read Agent Manifest",
      description:
        "Fetch a merchant agent's service manifest from their /.well-known/agent.json endpoint. " +
        "Returns the merchant's name, wallet address, available services, descriptions, and pricing. " +
        "Use this to inspect what a specific merchant offers and at what cost before probing or paying.",
      inputSchema: {
        manifest_url: z
          .string()
          .url()
          .describe(
            "Full URL to the agent manifest (e.g. https://example.com/.well-known/agent.json)",
          ),
      },
      annotations: {
        title: "Read Agent Manifest",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ manifest_url }) => {
      try {
        const resp = await fetch(manifest_url, {
          signal: AbortSignal.timeout(10000),
        });

        if (!resp.ok) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error: Manifest URL returned HTTP ${resp.status} ${resp.statusText}`,
              },
            ],
            isError: true,
          };
        }

        const manifest = (await resp.json()) as Record<string, unknown>;

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  manifest_url,
                  ...manifest,
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
              text: `Error fetching manifest: ${err.message}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
