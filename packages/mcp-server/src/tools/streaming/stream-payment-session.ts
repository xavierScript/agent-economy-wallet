/**
 * tools/streaming/stream-payment-session.ts
 *
 * MCP tool – open a per-compute streaming payment session via MagicBlock ER.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WalletServices } from "../../services.js";

export function registerStreamPaymentSessionTool(
  server: McpServer,
  services: WalletServices,
) {
  server.registerTool(
    "stream_payment_session",
    {
      title: "Open Streaming Payment Session",
      description:
        "Open a per-compute streaming payment session. Creates a StreamSession PDA on Solana, " +
        "delegates it to MagicBlock Ephemeral Rollup, then ticks USDC from buyer to merchant in " +
        "real time. Returns sessionId — use close_stream_session to end it.",
      inputSchema: {
        wallet_id: z.string().describe("Wallet ID (UUID) to pay from"),
        merchant_address: z
          .string()
          .describe("Merchant Solana address (base58 public key)"),
        rate_per_tick: z
          .number()
          .positive()
          .describe(
            "USDC base units per tick. 1000 = 0.001 USDC (6 decimal places)",
          ),
        interval_ms: z
          .number()
          .min(500)
          .describe("Milliseconds between ticks. Minimum 500."),
        mint: z
          .string()
          .optional()
          .describe(
            "Token mint address (default: devnet USDC). Base58 public key.",
          ),
        max_duration_ms: z
          .number()
          .optional()
          .describe(
            "Maximum session duration in ms before auto-close (default: 60000)",
          ),
      },
      annotations: {
        title: "Open Streaming Payment Session",
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({
      wallet_id,
      merchant_address,
      rate_per_tick,
      interval_ms,
      mint,
      max_duration_ms,
    }) => {
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
        const session = await services.streamingPayment.openSession({
          walletId: wallet_id,
          merchantAddress: merchant_address,
          ratePerTick: rate_per_tick,
          intervalMs: interval_ms,
          mint,
          maxDurationMs: max_duration_ms,
        });

        const maxDuration = max_duration_ms || 60000;

        return {
          content: [
            {
              type: "text" as const,
              text: [
                "✓ Streaming session opened on MagicBlock ER",
                "",
                `Session ID:      ${session.sessionId}`,
                `PDA:             ${session.pdaAddress}`,
                `Merchant:        ${session.merchantAddress}`,
                `Rate:            ${session.ratePerTick} base units every ${session.intervalMs}ms`,
                `ER Endpoint:     ${session.erEndpoint}`,
                `Max duration:    ${maxDuration}ms`,
                "",
                "Ticks are firing. Use get_stream_status to monitor.",
                "Use close_stream_session to end and settle on Solana L1.",
              ].join("\n"),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error opening streaming session: ${err.message}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
