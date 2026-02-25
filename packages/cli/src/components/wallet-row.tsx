/**
 * components/wallet-row.tsx
 *
 * Single wallet row with label, truncated ID, public key, and SOL balance.
 */

import { Box, Text } from "ink";
import type { WalletInfo } from "@agentic-wallet/core";

interface WalletRowProps {
  wallet: WalletInfo;
  /** Show full public key instead of truncated. */
  full?: boolean;
}

export function WalletRow({ wallet, full = false }: WalletRowProps) {
  const pk = full ? wallet.publicKey : wallet.publicKey.substring(0, 24) + "…";

  return (
    <Box>
      <Text color="green">{"● "}</Text>
      <Text bold>{wallet.label}</Text>
      <Text dimColor>{"  (" + wallet.id.substring(0, 8) + "…)  "}</Text>
      <Text>{pk}</Text>
      <Text>{"  "}</Text>
      <Text bold color="green">
        {wallet.balanceSol.toFixed(4)} SOL
      </Text>
    </Box>
  );
}
