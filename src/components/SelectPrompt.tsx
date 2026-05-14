import { Select, type SelectProps } from '@inkjs/ui';
import { Box, type BoxProps, Text, useInput } from 'ink';

interface SelectPromptProps extends SelectProps {
  borderStyle?: BoxProps['borderStyle'];
  children?: React.ReactNode;
  onCancel?: () => void;
}

interface SelectPromptHintProps {
  message?: string;
  escapeLabel?: string;
}

export function SelectPrompt({
  borderStyle,
  children,
  onCancel,
  ...selectProps
}: SelectPromptProps) {
  useInput((input, key) => {
    // Esc or Ctrl+C
    if (key.escape || (key.ctrl && input === 'c')) {
      onCancel?.();
    }
  });

  return (
    <Box borderStyle={borderStyle} flexDirection="column">
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
