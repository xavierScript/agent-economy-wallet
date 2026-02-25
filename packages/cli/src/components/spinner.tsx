/**
 * components/spinner.tsx
 *
 * Thin wrapper around ink-spinner with a message label.
 */

import { Text } from "ink";
import InkSpinner from "ink-spinner";

interface SpinnerProps {
  label?: string;
}

export function Spinner({ label = "Loading…" }: SpinnerProps) {
  return (
    <Text>
      <Text color="cyan">
        <InkSpinner type="dots" />
      </Text>
      {"  "}
      <Text dimColor>{label}</Text>
    </Text>
  );
}
