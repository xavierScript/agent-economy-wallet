import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WalletServices } from "../../services.js";

export function registerMonitorNetworkOracleTool(
  server: McpServer,
  services: WalletServices,
) {
  server.registerTool(
    "monitor_network_oracle",
    {
      title: "Monitor Network Oracle",
      description:
        "Stream live Solana block latency data for X seconds from a merchant over an active MagicBlock Ephemeral Rollup payment session. Use this to assess real-time network conditions. Provide the active payment session_id.",
      inputSchema: {
        session_id: z
          .string()
          .describe(
            "The active streaming payment session ID from stream_payment_session",
          ),
        duration_seconds: z
          .number()
          .min(1)
          .max(30)
          .describe("How many seconds to stream data for (max 30)"),
      },
    },
    async ({ session_id, duration_seconds }) => {
      if (!services.streamingPayment) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Streaming payments not configured.",
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
              text: `No active streaming session found for ID: ${session_id}`,
            },
          ],
          isError: true,
        };
      }

      const connection = services.connection.getConnection();
      const slots: { slot: number; ts: number; latencyMs?: number }[] = [];

      let lastSlotTs = Date.now();

      return new Promise((resolve) => {
        const subId = connection.onSlotChange((slotInfo) => {
          const now = Date.now();
          const latency = now - lastSlotTs;
          slots.push({ slot: slotInfo.slot, ts: now, latencyMs: latency });
          lastSlotTs = now;
        });

        setTimeout(() => {
          connection.removeSlotChangeListener(subId);

          let report = `### Network Oracle Live Stream (${duration_seconds}s)\n`;
          let totalLatency = 0;

          slots.slice(1).forEach((s) => {
            report += `- Tick ${s.ts}: Slot **${s.slot}** mined (latency: ${s.latencyMs}ms)\n`;
            if (s.latencyMs) totalLatency += s.latencyMs;
          });

          const avgLatency =
            slots.length > 1
              ? Math.round(totalLatency / (slots.length - 1))
              : 0;
          report += `\n**Average Block Latency**: ${avgLatency}ms\n`;
          report += `**Total Paid so far**: ${(session.totalPaid / 1_000_000).toFixed(6)} USDC\n`;
          report += `**Merchant Ticks recorded**: ${session.tickCount}\n`;
          report += `\nCondition is ${avgLatency < 500 ? "OPTIMAL" : "CONGESTED"}. Safe to settle stream.`;

          resolve({
            content: [{ type: "text" as const, text: report }],
          });
        }, duration_seconds * 1000);
      });
    },
  );
}
