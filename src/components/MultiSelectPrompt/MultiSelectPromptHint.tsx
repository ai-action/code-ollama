import { Text } from 'ink';

import { useTheme } from '@/contexts';

interface MultiSelectPromptHintProps {
  escapeLabel?: string;
}

/**
 * MultiSelect prompt hint component that displays:
 * Space to toggle (↑↓ to navigate, Enter to confirm, Esc/Ctrl+C to cancel)
 */
export function MultiSelectPromptHint({
  escapeLabel = 'cancel',
}: MultiSelectPromptHintProps) {
  const theme = useTheme();

  return (
    <Text color={theme.colors.secondary}>
      <Text bold>Space</Text>
      <Text dimColor> to toggle (</Text>
      <Text bold>↑↓</Text>
      <Text dimColor> to navigate, </Text>
      <Text bold>Enter</Text>
      <Text dimColor> to confirm, </Text>
      <Text bold>Esc</Text>
      <Text dimColor>/</Text>
      <Text bold>Ctrl+C</Text>
      <Text dimColor> to {escapeLabel})</Text>
    </Text>
  );
}
