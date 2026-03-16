/**
 * components/section.tsx
 *
 * Reusable section block with a full-width title rule.
 */

import { Box, Text } from "ink";
import type { ReactNode } from "react";

interface SectionProps {
  title: string;
  children: ReactNode;
}

export function Section({ title, children }: SectionProps) {
  return (
    <Box flexDirection="column" marginBottom={0}>
      <Text bold color="white">
        {" ◈ " + title.toUpperCase()}
      </Text>
      <Box
        borderStyle="round"
        borderColor="cyan"
        flexDirection="column"
        paddingX={2}
        paddingY={0}
      >
        {children}
      </Box>
    </Box>
  );
}
