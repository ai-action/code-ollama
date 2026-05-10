import { Box, Text, useInput } from 'ink';

import { MODE, UI } from '../constants';

interface Props {
  mode: MODE.Name;
  model: string;
  onToggleMode: () => void;
}

function getModeColor(mode: MODE.Name): string | undefined {
  switch (mode) {
    case MODE.NAME.PLAN:
      return 'blue';
    case MODE.NAME.AUTO:
      return 'red';
    case MODE.NAME.SAFE:
      return 'green';
    // v8 ignore next
    default:
      return undefined;
  }
}

export function Footer({ mode, model, onToggleMode }: Props) {
  // Keyboard shortcut to toggle mode (3-state cycle)
  useInput((_, key) => {
    if (key.tab && key.shift) {
      onToggleMode();
    }
  });

  const modeLabel = MODE.LABEL[mode];
  const modeColor = getModeColor(mode);

  return (
    <Box justifyContent="space-between" marginTop={1}>
      <Text dimColor>
        Mode: <Text color={modeColor}>{modeLabel}</Text> (Shift+Tab to toggle){' '}
        {UI.DIAMOND} Model: <Text color="cyan">{model}</Text>
      </Text>
    </Box>
  );
}
