import type { SelectProps } from '@inkjs/ui';
import { Select } from '@inkjs/ui';
import { Box, Text, useInput } from 'ink';

export interface SelectPromptProps extends SelectProps {
  children?: React.ReactNode;
  onEscape?: () => void;
}

interface SelectPromptHintProps {
  message?: string;
  escapeLabel?: string;
}

export function SelectPrompt({
  children,
  onEscape,
  ...selectProps
}: SelectPromptProps) {
  useInput((_, key) => {
    if (key.escape) {
      onEscape?.();
    }
  });

  return (
    <Box flexDirection="column">
      {children}

      <Select {...selectProps} />
    </Box>
  );
}

export function SelectPromptHint({
  message = 'Select option',
  escapeLabel = 'cancel',
}: SelectPromptHintProps) {
  return (
    // Select option (↑↓ + Enter to confirm, Esc to cancel)
    <Box flexDirection="row">
      <Text dimColor>{message} (</Text>
      <Text bold>↑↓</Text>
      <Text dimColor> + </Text>
      <Text bold>Enter</Text>
      <Text dimColor> to confirm, </Text>
      <Text bold>Esc</Text>
      <Text dimColor> to {escapeLabel})</Text>
    </Box>
  );
}
