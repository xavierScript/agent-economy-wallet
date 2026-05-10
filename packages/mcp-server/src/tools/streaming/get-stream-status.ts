/**
 * tools/streaming/get-stream-status.ts
 *
 * MCP tool – get real-time status of an active streaming session.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WalletServices } from "../../services.js";

export function registerGetStreamStatusTool(
  server: McpServer,
  services: WalletServices,
) {
  server.registerTool(
    "get_stream_status",
    {
      title: "Get Stream Session Status",
      description:
        "Get real-time status of an active streaming session — current tick count, " +
        "cumulative USDC paid, and session metadata from the MagicBlock ER.",
      inputSchema: {
        session_id: z
          .string()
          .describe("Session ID (UUID) returned by stream_payment_session"),
      },
      annotations: {
        title: "Get Stream Session Status",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ session_id }) => {
      if (!services.streamingPayment) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: StreamingPaymentService is not configured. Set YANGA_STREAM_PROGRAM_ID env var.",
            },
          ],
          isError: true,
        };
      }

      const session = services.streamingPayment.getSession(session_id);

      if (!session) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No active session found with ID: ${session_id}`,
            },
          ],
        };
      }

      const elapsedMs = Date.now() - session.startedAt.getTime();
      const totalUsdc = session.totalPaid / 1_000_000;

      return {
        content: [
          {
            type: "text" as const,
            text: [
              "📡 Active streaming session — running on MagicBlock ER",
              "",
              `Session ID:      ${session.sessionId}`,
              `PDA:             ${session.pdaAddress}`,
              `Status:          ${session.status}`,
              `Merchant:        ${session.merchantAddress}`,
              `Rate:            ${session.ratePerTick} base units / ${session.intervalMs}ms`,
              `Ticks so far:    ${session.tickCount}`,
              `Total paid:      ${session.totalPaid} base units (${totalUsdc} USDC)`,
              `Running for:     ${elapsedMs}ms`,
              `ER Endpoint:     ${session.erEndpoint}`,
            ].join("\n"),
          },
        ],
      };
    },
  );
}
