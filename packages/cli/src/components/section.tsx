/**
 * components/section.tsx
 *
 * Reusable section wrapper with a coloured title divider.
 */

import { Box, Text } from "ink";
import type { ReactNode } from "react";

interface SectionProps {
  title: string;
  children: ReactNode;
}

export function Section({ title, children }: SectionProps) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color="cyan">
        {"─── "}
        {title}
        {" ───"}
      </Text>
      <Box flexDirection="column" marginLeft={2} marginTop={0}>
        {children}
      </Box>
    </Box>
  );
}
