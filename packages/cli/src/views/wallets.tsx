/**
 * views/wallets.tsx
 *
 * Full wallet list with balances and public keys.
 */

import { Box, Text } from "ink";
import { useWallets } from "../hooks/use-wallets.js";
import { Section } from "../components/section.js";
import { Spinner } from "../components/spinner.js";
import type { WalletServices } from "../services.js";

interface WalletsViewProps {
  services: WalletServices;
  refreshKey: number;
}

export function WalletsView({ services, refreshKey }: WalletsViewProps) {
  const { wallets, loading, error } = useWallets(services, { refreshKey });

  return (
    <Box flexDirection="column">
      <Section title="All Wallets">
        {loading ? (
          <Spinner label="Fetching wallets…" />
        ) : error ? (
          <Text color="red">Error: {error}</Text>
        ) : wallets.length === 0 ? (
          <Text dimColor>No wallets found. Create one via the MCP server.</Text>
        ) : (
          wallets.map((w) => (
            <Box key={w.id} flexDirection="column" marginBottom={1}>
              <Box>
                <Text color="green" bold>
                  {"● "}
                </Text>
                <Text bold>{w.label}</Text>
                <Text dimColor>{"  " + w.id}</Text>
              </Box>

              <Box marginLeft={4}>
                <Text dimColor>Address </Text>
                <Text>{w.publicKey}</Text>
              </Box>

              <Box marginLeft={4}>
                <Text dimColor>Balance </Text>
                <Text bold color="green">
                  {w.balanceSol.toFixed(6)} SOL
                </Text>
                <Text dimColor>
                  {"  (" + w.balanceLamports.toLocaleString() + " lamports)"}
                </Text>
              </Box>
            </Box>
          ))
        )}
      </Section>

      <Box marginLeft={2}>
        <Text dimColor>{"Tip: Fund wallets at https://faucet.solana.com"}</Text>
      </Box>
    </Box>
  );
}
