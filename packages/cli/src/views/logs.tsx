/**
 * views/logs.tsx
 *
 * Scrollable (latest-first) audit log viewer.
 */

import { Box, Text } from "ink";
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
  const { logs, loading } = useLogs(services, {
    count: 30,
    refreshKey,
  });

  return (
    <Box flexDirection="column">
      <Section title={"Audit Trail (" + logs.length + " entries)"}>
        {loading ? (
          <Spinner label="Reading audit logs…" />
        ) : logs.length === 0 ? (
          <Text dimColor>No audit log entries yet.</Text>
        ) : (
          logs.map((log, i) => <LogEntry key={i} log={log} verbose />)
        )}
      </Section>
    </Box>
  );
}
