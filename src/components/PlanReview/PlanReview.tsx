import { Box, Text } from 'ink';
import { useCallback } from 'react';

import { MODE, THEME, UI } from '@/constants';
import type { Mode, ThemeDefinition } from '@/types';

import { SelectPrompt, SelectPromptHint } from '../SelectPrompt';

interface Props {
  planContent: string;
  onModeChange: (mode: Mode) => void;
  theme?: ThemeDefinition;
}

const options = [
  { label: 'Approve in Auto', value: MODE.AUTO },
  { label: 'Approve in Safe', value: MODE.SAFE },
  { label: 'Revise - Continue planning', value: MODE.PLAN },
];

export function PlanReview({
  planContent,
  onModeChange,
  theme = THEME.getTheme(),
}: Props) {
  const handleChange = useCallback(
    (value: string) => {
      onModeChange(value as Mode);
    },
    [onModeChange],
  );

  const handleEscape = useCallback(() => {
    onModeChange(MODE.PLAN);
  }, [onModeChange]);

  return (
    <Box marginX={UI.AGENT_MARGIN_X}>
      <SelectPrompt
        borderStyle="bold"
        options={options}
        onChange={handleChange}
        onCancel={handleEscape}
      >
        <Box flexDirection="column">
          <Text bold color={theme.colors.accent}>
            Plan Review - Choose next step:
          </Text>

          <Box marginY={1}>
            <Text>{planContent}</Text>
          </Box>

          <SelectPromptHint message="Select review action" />
        </Box>
      </SelectPrompt>
    </Box>
  );
}
