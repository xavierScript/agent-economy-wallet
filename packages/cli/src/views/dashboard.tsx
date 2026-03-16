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

  const totalSol = wallets.reduce((s, w) => s + w.balanceSol, 0);
  const successCount = logs.filter((l) => l.success).length;

  const koraActive = services.koraService !== null;
  const funderActive = services.masterFunder !== null;

  return (
    <Box flexDirection="column" paddingX={1} flexGrow={1}>
      {/* ── Stat cards ─────────────────────────── */}
      <Box
        marginBottom={1}
        justifyContent="space-around"
        width="100%"
        borderStyle="round"
        borderColor="gray"
        paddingX={1}
      >
        <Box>
          <Text dimColor>WALLETS: </Text>
          <Text bold color="white">
            {wLoading ? "…" : String(wallets.length)}
          </Text>
        </Box>
        <Text dimColor> │ </Text>
        <Box>
          <Text dimColor>TOTAL SOL: </Text>
          <Text bold color="green">
            {wLoading ? "…" : totalSol.toFixed(4)}
          </Text>
        </Box>
        <Text dimColor> │ </Text>
        <Box>
          <Text dimColor>CLUSTER: </Text>
          <Text bold color="cyan">
            {services.config.cluster.toUpperCase()}
          </Text>
        </Box>
        <Text dimColor> │ </Text>
        <Box>
          <Text dimColor>KORA: </Text>
          <Text bold color={koraActive ? "green" : "gray"}>
            {koraActive ? "gasless" : "off"}
          </Text>
        </Box>
        <Text dimColor> │ </Text>
        <Box>
          <Text dimColor>FUNDER: </Text>
          <Text bold color={funderActive ? "green" : "gray"}>
            {funderActive ? "ready" : "off"}
          </Text>
        </Box>
      </Box>

      {/* ── Wallet list ────────────────────────── */}
      <Box flexDirection="column" marginRight={2} marginBottom={1}>
        <Section title="Wallets">
          {wLoading ? (
            <Spinner label="Loading wallets…" />
          ) : wallets.length === 0 ? (
            <Text dimColor italic>
              No wallets yet — create one via the MCP server.
            </Text>
          ) : (
            <Box flexDirection="column">
              {wallets.slice(0, 5).map((w) => (
                <WalletRow key={w.id} wallet={w} />
              ))}
              {wallets.length > 5 && (
                <Text dimColor>
                  {"  … and " +
                    (wallets.length - 5) +
                    " more (see Wallets tab)"}
                </Text>
              )}
            </Box>
          )}
        </Section>
      </Box>

      {/* ── Recent activity ────────────────────── */}
      <Box flexDirection="column" marginRight={2} marginBottom={1}>
        <Section
          title={
            "Recent Activity" +
            (logs.length > 0
              ? "  " + successCount + "/" + logs.length + " ok"
              : "")
          }
        >
          {lLoading ? (
            <Spinner label="Loading logs…" />
          ) : logs.length === 0 ? (
            <Text dimColor>No activity recorded yet.</Text>
          ) : (
            <Box flexDirection="column">
              {logs.slice(0, 4).map((log, i) => (
                <LogEntry key={i} log={log} />
              ))}
            </Box>
          )}
        </Section>
      </Box>
    </Box>
  );
}
