/**
 * app.tsx
 *
 * Root component — manages view state and global keyboard shortcuts.
 */

import { useState, useEffect } from "react";
import { Box, useInput, useApp, useStdout } from "ink";
import { Header } from "./components/header.js";
import { Nav, type ViewName } from "./components/nav.js";
import { Footer } from "./components/footer.js";
import { DashboardView } from "./views/dashboard.js";
import { WalletsView } from "./views/wallets.js";
import { LogsView } from "./views/logs.js";
import { RegistryView } from "./views/registry.js";
import type { WalletServices } from "./services.js";

interface AppProps {
  services: WalletServices;
}

export function App({ services }: AppProps) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [view, setView] = useState<ViewName>("dashboard");
  const [refreshKey, setRefreshKey] = useState(0);

  const [size, setSize] = useState({
    columns: stdout?.columns ?? 80,
    rows: stdout?.rows ?? 24,
  });

  useEffect(() => {
    if (!stdout || !("on" in stdout)) return;
    const onResize = () =>
      setSize({ columns: stdout.columns, rows: stdout.rows });
    stdout.on("resize", onResize);
    return () => {
      stdout.off("resize", onResize);
    };
  }, [stdout]);

  useInput((input) => {
    if (input === "q") exit();
    if (input === "1") setView("dashboard");
    if (input === "2") setView("wallets");
    if (input === "3") setView("logs");
    if (input === "4") setView("registry");
    if (input === "r") setRefreshKey((k) => k + 1);
  });

  return (
    <Box
      flexDirection="column"
      paddingX={1}
      width={size.columns}
      height={size.rows}
    >
      <Box flexShrink={0} flexDirection="column">
        <Header cluster={services.config.cluster} />
        <Nav active={view} />
      </Box>

      <Box
        flexDirection="column"
        flexGrow={1}
        flexShrink={1}
        flexBasis={0}
        overflow="hidden"
      >
        {view === "dashboard" && (
          <DashboardView services={services} refreshKey={refreshKey} />
        )}
        {view === "wallets" && (
          <WalletsView services={services} refreshKey={refreshKey} />
        )}
        {view === "logs" && (
          <LogsView services={services} refreshKey={refreshKey} />
        )}
        {view === "registry" && (
          <RegistryView services={services} refreshKey={refreshKey} />
        )}
      </Box>

      <Box flexShrink={0}>
        <Footer services={services} view={view} />
      </Box>
    </Box>
  );
}
