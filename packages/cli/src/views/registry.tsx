/**
 * views/registry.tsx
 *
 * Displays the discovered agents from the decentralized registry.
 */

import { Box, Text } from "ink";
import { useRegistry } from "../hooks/use-registry.js";
import { Section } from "../components/section.js";
import { Spinner } from "../components/spinner.js";
import type { WalletServices } from "../services.js";

interface RegistryViewProps {
  services: WalletServices;
  refreshKey: number;
}

export function RegistryView({ services, refreshKey }: RegistryViewProps) {
  const { agents, loading, error } = useRegistry(services, { refreshKey });

  if (error) {
    return (
      <Box padding={1} flexDirection="column">
        <Text color="red" bold>
          Error fetching registry:
        </Text>
        <Text color="red">{error}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={1} flexGrow={1} overflow="hidden">
      <Section
        title={
          "Decentralized Agent Registry" +
          (!loading ? " (" + agents.length + " found)" : "")
        }
      >
        <Box flexDirection="column" overflow="hidden">
          {loading ? (
            <Spinner label="Scanning blockchain for agents…" />
          ) : agents.length === 0 ? (
            <Text dimColor italic>
              No agents registered yet on this cluster.
            </Text>
          ) : (
            agents.map((agent, i) => {
              const servicesCount = Array.isArray(agent.services)
                ? agent.services.length
                : 0;

              return (
                <Box
                  key={i}
                  flexDirection="column"
                  marginBottom={1}
                  paddingX={1}
                  borderStyle="single"
                  borderColor="gray"
                >
                  <Box>
                    <Text bold color="cyan">
                      {agent.name}
                    </Text>
                    <Text dimColor>
                      {" "}
                      ({servicesCount} service{servicesCount === 1 ? "" : "s"})
                    </Text>
                  </Box>
                  <Box>
                    <Text dimColor>Manifest: </Text>
                    <Text underline>{agent.manifest_url}</Text>
                  </Box>
                  <Box>
                    <Text dimColor>Registered by: </Text>
                    <Text>{agent.registered_by}</Text>
                  </Box>
                  <Box>
                    <Text dimColor>Registered at: </Text>
                    <Text>
                      {agent.registered_at !== "unknown"
                        ? new Date(agent.registered_at).toLocaleString()
                        : "unknown"}
                    </Text>
                  </Box>
                </Box>
              );
            })
          )}
        </Box>
      </Section>
    </Box>
  );
}
