/**
 * components/log-entry.tsx
 *
 * Single audit-log row used in both Dashboard and Logs views.
 */

import { Box, Text } from "ink";
import type { AuditLogEntry } from "@agentic-wallet/core";

interface LogEntryProps {
  log: AuditLogEntry;
  /** Show extra detail (tx signature, error). Default false. */
  verbose?: boolean;
}

export function LogEntry({ log, verbose = false }: LogEntryProps) {
  const icon = log.success ? "✓" : "✗";
  const color = log.success ? "green" : "red";

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={color}>{icon}</Text>
        <Text> </Text>
        <Text bold>{log.action}</Text>
        <Text> </Text>
        {log.walletId && (
          <Text dimColor>{"wallet:" + log.walletId.substring(0, 8)}</Text>
        )}
        <Text> </Text>
        <Text dimColor>{log.timestamp}</Text>
      </Box>

      {verbose && log.txSignature && (
        <Box marginLeft={3}>
          <Text dimColor>
            {"tx: " + log.txSignature.substring(0, 44) + "…"}
          </Text>
        </Box>
      )}

      {verbose && log.error && (
        <Box marginLeft={3}>
          <Text color="red">{log.error}</Text>
        </Box>
      )}
    </Box>
  );
}
