import { Box, Text, useInput } from 'ink';

import { MODE, UI } from '@/constants';
import { useTheme } from '@/contexts';
import type { Mode, ThemeDefinition } from '@/types';

interface Props {
  mode: Mode;
  model: string;
  onToggleMode: () => void;
}

function getModeColor(mode: Mode, theme: ThemeDefinition): string | undefined {
  switch (mode) {
    case MODE.PLAN:
      return theme.colors.modePlan;

    case MODE.AUTO:
      return theme.colors.modeAuto;

    case MODE.SAFE:
      return theme.colors.modeSafe;

    // v8 ignore next
    default:
      return undefined;
  }
}

export function Footer({ mode, model, onToggleMode }: Props) {
  const theme = useTheme();
  const modelLabel = model || 'not configured';

  // Keyboard shortcut to toggle mode (3-state cycle)
  useInput((_, key) => {
    if (key.tab && key.shift) {
      onToggleMode();
    }
  });

  const modeLabel = MODE.LABEL[mode];
  const modeColor = getModeColor(mode, theme);

  return (
    <Box justifyContent="space-between" marginTop={1}>
      <Text color={theme.colors.secondary} dimColor>
        Mode: <Text color={modeColor}>{modeLabel}</Text> (Shift+Tab to toggle){' '}
        {UI.DIAMOND} Model: <Text color={theme.colors.model}>{modelLabel}</Text>{' '}
        {UI.DIAMOND} <Text bold>?</Text> shortcuts
      </Text>
    </Box>
  );
}
