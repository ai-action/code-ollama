import { Text } from 'ink';

import { useTheme } from '@/contexts';

export function MultilineTextInputHint() {
  const theme = useTheme();

  return (
    <Text color={theme.colors.secondary}>
      <Text bold>Enter</Text>
      <Text dimColor> newline, </Text>
      <Text bold>Ctrl+S</Text>
      <Text dimColor> save, </Text>
      <Text bold>Esc</Text>
      <Text dimColor>/</Text>
      <Text bold>Ctrl+C</Text>
      <Text dimColor> cancel</Text>
    </Text>
  );
}
