/**
 * views/logs.tsx
 *
 * Verbose audit log viewer with success/failure summary.
 */

import { Box, Text, useInput } from "ink";
import { useState } from "react";
import { useLogs } from "../hooks/use-logs.js";
import { Section } from "../components/section.js";
import { Spinner } from "../components/spinner.js";
import { LogEntry } from "../components/log-entry.js";
import type { WalletServices } from "../services.js";

interface LogsViewProps {
  services: WalletServices;
  refreshKey: number;
}

export function LogsView({ services, refreshKey }: LogsViewProps) {
  const { logs, loading } = useLogs(services, { count: 30, refreshKey });
  const [scrollOffset, setScrollOffset] = useState(0);

  const successCount = logs.filter((l) => l.success).length;
  const failCount = logs.length - successCount;

  useInput((input, key) => {
    if (key.upArrow || input === "k") {
      setScrollOffset((prev) => Math.max(0, prev - 1));
    }
    if (key.downArrow || input === "j") {
      setScrollOffset((prev) =>
        Math.min(prev + 1, Math.max(0, logs.length - 8)),
      );
    }
  });

  const visibleLogs = logs.slice(scrollOffset, scrollOffset + 8);

  return (
    <Box flexDirection="column" paddingX={1} flexGrow={1} overflow="hidden">
      <Section title={`Audit Trail  (${logs.length} entries)`}>
        {loading ? (
          <Spinner label="Reading audit logs…" />
        ) : logs.length === 0 ? (
          <Text dimColor italic>
            No audit log entries yet.
          </Text>
        ) : (
          <Box flexDirection="column">
            <Box
              marginBottom={1}
              borderStyle="round"
              borderColor="gray"
              paddingX={2}
              width="50%"
            >
              <Text bold color="green">
                {"✓ " + successCount + " SUCCESS"}
              </Text>
              <Text dimColor>{"  │  "}</Text>
              <Text bold color={failCount > 0 ? "red" : "gray"}>
                {"✗ " + failCount + " FAILED"}
              </Text>
            </Box>

            <Box alignSelf="flex-end" paddingRight={2}>
              <Text dimColor color="yellow">
                Use j/k or ↑/↓ to scroll logs
              </Text>
            </Box>

            {scrollOffset > 0 && (
              <Text dimColor> ↑ {scrollOffset} earlier logs</Text>
            )}
            {visibleLogs.map((log, i) => (
              <LogEntry key={i} log={log} verbose />
            ))}
            {scrollOffset + 8 < logs.length && (
              <Text dimColor>
                {" "}
                ↓ {logs.length - (scrollOffset + 8)} more logs
              </Text>
            )}
          </Box>
        )}
      </Section>
    </Box>
  );
}
