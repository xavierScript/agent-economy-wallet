/**
 * views/streams.tsx
 *
 * Real-time viewer for MagicBlock Ephemeral Rollup streaming payments.
 * Polls at 500ms to catch ticks beautifully.
 */

import { Box, Text, useInput } from "ink";
import { useState } from "react";
import { useLogs } from "../hooks/use-logs.js";
import { Section } from "../components/section.js";
import { Spinner } from "../components/spinner.js";
import type { WalletServices } from "../services.js";

// Ensure color extraction
function getSessionColor(sessionId: string): string {
  const colors = ["cyan", "magenta", "blue", "yellow", "green"];
  const charCode = sessionId.charCodeAt(0) || 0;
  return colors[charCode % colors.length];
}

interface StreamsViewProps {
  services: WalletServices;
  refreshKey: number;
}

export function StreamsView({ services, refreshKey }: StreamsViewProps) {
  // Poll faster specifically for the streaming view
  const { logs, loading } = useLogs(services, {
    count: 100,
    allowFasterPolling: true,
    interval: 300,
    refreshKey,
  });

  // Filter out stream-related actions
  const streamLogs = logs.filter((l) => l.action.startsWith("stream_"));

  const [scrollOffset, setScrollOffset] = useState(0);

  useInput((input, key) => {
    if (key.upArrow || input === "k") {
      setScrollOffset((prev) => Math.max(0, prev - 1));
    }
    if (key.downArrow || input === "j") {
      setScrollOffset((prev) =>
        Math.min(prev + 1, Math.max(0, streamLogs.length - 12)),
      );
    }
  });

  const visibleLogs = streamLogs.slice(scrollOffset, scrollOffset + 12);

  return (
    <Box flexDirection="column" paddingX={1} flexGrow={1} overflow="hidden">
      <Section title={"⚡ Ephemeral Rollup Streams"}>
        {loading ? (
          <Spinner label="Syncing Rollup Ticks…" />
        ) : streamLogs.length === 0 ? (
          <Text dimColor italic>
            No active streams. Await an agent to open a Stream Payment Session.
          </Text>
        ) : (
          <Box flexDirection="column">
            {visibleLogs.map((log, i) => {
              const sid = (log.details as any)?.sessionId || "unknown";
              const shortSid = sid.split("-")[0];
              const color = getSessionColor(sid);

              if (log.action === "stream_session_open") {
                return (
                  <Text key={i} bold color="green">
                    [L1 {"->"} L2] Session {shortSid} Opened (
                    {(log.details as any)?.ratePerTick / 1000000} USDC /{" "}
                    {(log.details as any)?.intervalMs}ms)
                  </Text>
                );
              }
              if (log.action === "stream_session_close") {
                return (
                  <Text key={i} bold color="red">
                    [L2 {"->"} L1] Session {shortSid} Closed & Settled (Total:{" "}
                    {(log.details as any)?.totalPaid / 1000000} USDC)
                  </Text>
                );
              }
              if (log.action === "stream_tick") {
                return (
                  <Text key={i} color={color}>
                    {"  ⚡ Tick #"}
                    {(log.details as any)?.tickCount} SUCCESS: Paid{" "}
                    {log.details?.totalPaid
                      ? ((log.details as any)?.totalPaid / 1000000).toFixed(6)
                      : "..."}{" "}
                    USDC
                  </Text>
                );
              }
              return (
                <Text key={i} dimColor>
                  {log.action}: {JSON.stringify(log.details)}
                </Text>
              );
            })}
          </Box>
        )}
      </Section>
    </Box>
  );
}
