/**
 * components/header.tsx
 *
 * Top banner — shows branding and active cluster.
 */

import { Box, Text } from "ink";

interface HeaderProps {
  cluster: string;
}

export function Header({ cluster }: HeaderProps) {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      paddingX={1}
      width="100%"
    >
      <Box justifyContent="center" width="100%">
        <Text bold color="cyan">
          {"  ◈  AGENTIC WALLET  ◈  "}
        </Text>
      </Box>
      <Box justifyContent="center" width="100%">
        <Text italic dimColor>
          Autonomous Solana Operations Engine |{" "}
          <Text color="cyan" bold>
            ◈ {cluster.toUpperCase()}
          </Text>
        </Text>
      </Box>
    </Box>
  );
}
