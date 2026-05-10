/**
 * components/footer.tsx
 *
 * Bottom status bar — shows cluster badge, RPC url, and
 * context-sensitive key hints for the current view.
 */

import { Box, Text } from "ink";
import type { WalletServices } from "../services.js";
import type { ViewName } from "./nav.js";

const HINTS: Record<ViewName, string> = {
  dashboard: "[1-5] switch  [r] refresh  [q] quit",
  wallets:
    "[j/k] navigate  [x] close wallet  [1-5] switch  [r] refresh  [q] quit",
  logs: "[1-5] switch  [r] refresh  [q] quit",
  registry: "[1-5] switch  [r] refresh  [q] quit",
  streams: "[1-5] switch  [j/k] scroll  [r] refresh  [q] quit",
};

interface FooterProps {
  services: WalletServices;
  view: ViewName;
}

export function Footer({ services, view }: FooterProps) {
  const { config } = services;
  return (
    <Box
      marginTop={1}
      borderStyle="round"
      borderColor="blue"
      paddingX={1}
      justifyContent="space-between"
    >
      <Box>
        <Text backgroundColor="cyan" color="black" bold>
          {" ◈ " + config.cluster.toUpperCase() + " "}
        </Text>
        <Text dimColor>{"  " + config.rpcUrl}</Text>
      </Box>
      <Box>
        <Text color="yellow">⌨ {HINTS[view]}</Text>
      </Box>
    </Box>
  );
}
