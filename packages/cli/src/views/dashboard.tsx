/**
 * views/dashboard.tsx
 *
 * Default view — quick overview of wallets and recent activity.
 */

import { Box, Text } from "ink";
import { useWallets } from "../hooks/use-wallets.js";
import { useLogs } from "../hooks/use-logs.js";
import { Section } from "../components/section.js";
import { Spinner } from "../components/spinner.js";
import { WalletRow } from "../components/wallet-row.js";
import { LogEntry } from "../components/log-entry.js";
import type { WalletServices } from "../services.js";

interface DashboardViewProps {
  services: WalletServices;
  refreshKey: number;
}

export function DashboardView({ services, refreshKey }: DashboardViewProps) {
  const { wallets, loading: wLoading } = useWallets(services, { refreshKey });
  const { logs, loading: lLoading } = useLogs(services, {
    count: 8,
    refreshKey,
  });

  return (
    <Box flexDirection="column">
      {/* ── System ─────────────────────────────── */}
      <Section title="System">
        <Box>
          <Text dimColor>Cluster </Text>
          <Text bold>{services.config.cluster.toUpperCase()}</Text>
          <Text>{"   "}</Text>
          <Text dimColor>Wallets </Text>
          <Text bold>{wLoading ? "…" : String(wallets.length)}</Text>
        </Box>
      </Section>

      {/* ── Wallets ────────────────────────────── */}
      <Section title="Wallets">
        {wLoading ? (
          <Spinner label="Loading wallets…" />
        ) : wallets.length === 0 ? (
          <Text dimColor>
            No wallets yet — create one via the MCP server or directly.
          </Text>
        ) : (
          wallets.map((w) => <WalletRow key={w.id} wallet={w} />)
        )}
      </Section>

      {/* ── Activity ───────────────────────────── */}
      <Section title="Recent Activity">
        {lLoading ? (
          <Spinner label="Loading logs…" />
        ) : logs.length === 0 ? (
          <Text dimColor>No activity recorded yet.</Text>
        ) : (
          logs.map((log, i) => <LogEntry key={i} log={log} />)
        )}
      </Section>
    </Box>
  );
}
