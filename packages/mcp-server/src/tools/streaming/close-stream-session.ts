/**
 * tools/streaming/close-stream-session.ts
 *
 * MCP tool – close an active streaming session, undelegate from ER,
 * commit final state to Solana L1.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WalletServices } from "../../services.js";

export function registerCloseStreamSessionTool(
  server: McpServer,
  services: WalletServices,
) {
  server.registerTool(
    "close_stream_session",
    {
      title: "Close Streaming Payment Session",
      description:
        "Close an active streaming session. Undelegates PDA from MagicBlock ER, " +
        "commits final state to Solana L1, and returns total USDC paid with " +
        "on-chain settlement signature.",
      inputSchema: {
        session_id: z
          .string()
          .describe("Session ID (UUID) returned by stream_payment_session"),
      },
      annotations: {
        title: "Close Streaming Payment Session",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
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

      try {
        const result =
          await services.streamingPayment.closeSession(session_id);

        const totalUsdc = result.totalPaid / 1_000_000;

        return {
          content: [
            {
              type: "text" as const,
              text: [
                "✓ Stream session closed — state committed to Solana L1",
                "",
                `Session ID:      ${result.sessionId}`,
                `Total paid:      ${result.totalPaid} base units (${totalUsdc} USDC)`,
                `Ticks:           ${result.tickCount}`,
                `Duration:        ${result.durationMs}ms`,
                `Settlement tx:   ${result.settlementSignature}`,
                `Solscan:         ${result.solscanUrl}`,
              ].join("\n"),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error closing streaming session: ${err.message}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
