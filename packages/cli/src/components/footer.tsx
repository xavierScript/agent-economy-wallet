/**
 * components/footer.tsx
 *
 * Bottom status bar showing cluster, RPC, and auto-refresh indicator.
 */

import { Box, Text } from "ink";
import type { WalletServices } from "../services.js";

interface FooterProps {
  services: WalletServices;
}

export function Footer({ services }: FooterProps) {
  const { config } = services;

  return (
    <Box marginTop={1} paddingX={1} borderStyle="single" borderColor="gray">
      <Text dimColor>
        {"◈ "}
        {config.cluster.toUpperCase()}
        {"  │  "}
        {config.rpcUrl}
        {"  │  auto-refresh ●"}
      </Text>
    </Box>
  );
}
