/**
 * components/nav.tsx
 *
 * Horizontal tab bar. Active tab renders as an inverted-colour pill;
 * inactive tabs show their numeric shortcut in dimmer text.
 */

import { Box, Text } from "ink";

export type ViewName = "dashboard" | "wallets" | "logs";

const tabs: { key: string; label: string; view: ViewName }[] = [
  { key: "1", label: "Dashboard", view: "dashboard" },
  { key: "2", label: "Wallets", view: "wallets" },
  { key: "3", label: "Logs", view: "logs" },
];

interface NavProps {
  active: ViewName;
}

export function Nav({ active }: NavProps) {
  return (
    <Box
      marginTop={1}
      marginBottom={1}
      borderStyle="round"
      borderColor="green"
      paddingX={2}
      justifyContent="center"
    >
      {tabs.map((tab) => {
        const isActive = active === tab.view;
        return (
          <Box key={tab.view} marginX={2}>
            {isActive ? (
              <Text backgroundColor="green" color="black" bold>
                {"  [ " + tab.key + " ] " + tab.label.toUpperCase() + "  "}
              </Text>
            ) : (
              <Text dimColor color="white">
                {"  " + tab.key + " : " + tab.label + "  "}
              </Text>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
