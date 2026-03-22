/**
 * views/logs.tsx
 *
 * Verbose audit log viewer with success/failure summary.
 * Includes an inline source filter: All / x402 Merchant / Kora Paymaster.
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

type LogSource = "all" | "x402" | "kora";

const SOURCE_LABELS: Record<LogSource, string> = {
  all: "All",
  x402: "x402 Merchant",
  kora: "Kora Paymaster",
};

const SOURCE_KEYS: Record<string, LogSource> = {
  a: "all",
  x: "x402",
  k: "kora",
};

function matchesSource(action: string, source: LogSource): boolean {
  if (source === "all") return true;
  if (source === "x402") return action.startsWith("x402:");
  if (source === "kora") {
    // Kora-relayed entries are logged under the calling action name but carry
    // `{ gasless: true }` in details. We also pick up any future `kora:` prefix.
    return action.startsWith("kora:");
  }
  return true;
}

export function LogsView({ services, refreshKey }: LogsViewProps) {
  const { logs, loading } = useLogs(services, { count: 50, refreshKey });
  const [scrollOffset, setScrollOffset] = useState(0);
  const [source, setSource] = useState<LogSource>("all");

  // Apply source filter
  const filteredLogs = logs.filter((l) => {
    if (source === "kora") {
      // Include explicit kora: prefix OR any entry relayed gaslessly
      return (
        l.action.startsWith("kora:") ||
        ((l.details as any)?.gasless === true)
      );
    }
    return matchesSource(l.action, source);
  });

  const successCount = filteredLogs.filter((l) => l.success).length;
  const failCount = filteredLogs.length - successCount;

  useInput((input, key) => {
    // Source filter shortcuts
    if (input in SOURCE_KEYS) {
      setSource(SOURCE_KEYS[input]);
      setScrollOffset(0);
      return;
    }
    // Scroll
    if (key.upArrow || input === "j") {
      setScrollOffset((prev) => Math.max(0, prev - 1));
    }
    if (key.downArrow || input === "i") {
      setScrollOffset((prev) =>
        Math.min(prev + 1, Math.max(0, filteredLogs.length - 8)),
      );
    }
  });

  const visibleLogs = filteredLogs.slice(scrollOffset, scrollOffset + 8);

  const sectionTitle =
    source === "all"
      ? `Audit Trail  (${filteredLogs.length} entries)`
      : `${SOURCE_LABELS[source]} Trail  (${filteredLogs.length} entries)`;

  return (
    <Box flexDirection="column" paddingX={1} flexGrow={1} overflow="hidden">
      {/* ── Source filter bar ─────────────────────────────────────── */}
      <Box marginBottom={1} gap={2}>
        {(["all", "x402", "kora"] as LogSource[]).map((s) => {
          const isActive = source === s;
          const keyHint = Object.entries(SOURCE_KEYS).find(
            ([, v]) => v === s,
          )?.[0];
          return (
            <Box key={s}>
              {isActive ? (
                <Text backgroundColor="green" color="black" bold>
                  {"  [" + keyHint?.toUpperCase() + "] " + SOURCE_LABELS[s] + "  "}
                </Text>
              ) : (
                <Text dimColor color="white">
                  {"  " + keyHint?.toUpperCase() + " : " + SOURCE_LABELS[s] + "  "}
                </Text>
              )}
            </Box>
          );
        })}
      </Box>

      <Section title={sectionTitle}>
        {loading ? (
          <Spinner label="Reading audit logs…" />
        ) : filteredLogs.length === 0 ? (
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
                j/k scroll  ·  a/x/k filter
              </Text>
            </Box>

            {scrollOffset > 0 && (
              <Text dimColor> ↑ {scrollOffset} earlier logs</Text>
            )}
            {visibleLogs.map((log, i) => (
              <LogEntry key={i} log={log} verbose />
            ))}
            {scrollOffset + 8 < filteredLogs.length && (
              <Text dimColor>
                {" "}
                ↓ {filteredLogs.length - (scrollOffset + 8)} more logs
              </Text>
            )}
          </Box>
        )}
      </Section>
    </Box>
  );
}
