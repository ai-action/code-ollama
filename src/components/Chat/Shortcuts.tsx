import { Box, Text } from 'ink';

import { UI } from '@/constants';
import { useTheme } from '@/contexts';

const SHORTCUTS = [
  ['?', 'show shortcuts'],
  ['Enter', 'submit prompt'],
  ['↑/↓', 'browse prompt history'],
  ['Ctrl+R', 'search prompt history'],
  ['Ctrl+V', 'attach clipboard image'],
  ['Shift+Tab', 'change mode'],
  ['Ctrl+C', 'clear, interrupt, or exit'],
  ['/, @, !', 'commands, files, and shell'],
] as const;

export function Shortcuts() {
  const theme = useTheme();

  return (
    <Box
      borderColor={theme.colors.border}
      borderStyle="bold"
      flexDirection="column"
      marginBottom={1}
      marginX={UI.SCREEN_MARGIN_X}
      paddingX={1}
    >
      <Text bold>Keyboard shortcuts</Text>
      {SHORTCUTS.map(([shortcut, description]) => (
        <Text key={shortcut}>
          <Text color={theme.colors.command}>{shortcut.padEnd(12)}</Text>
          <Text color={theme.colors.secondary}>{description}</Text>
        </Text>
      ))}
    </Box>
  );
}
