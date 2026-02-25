/**
 * components/header.tsx
 *
 * Top banner rendered once across all views.
 */

import { Box, Text } from "ink";

export function Header() {
  return (
    <Box flexDirection="column">
      <Text bold color="cyan">
        {"╔══════════════════════════════════════════════╗"}
      </Text>
      <Text bold color="cyan">
        {"║    ◈  Agentic Wallet  —  Solana Observer    ║"}
      </Text>
      <Text bold color="cyan">
        {"╚══════════════════════════════════════════════╝"}
      </Text>
    </Box>
  );
}
