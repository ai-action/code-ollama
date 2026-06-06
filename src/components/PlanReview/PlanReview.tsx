import { Box, Text } from 'ink';
import { useCallback } from 'react';

import { Markdown } from '@/components/Markdown';
import { MODE, UI } from '@/constants';
import { useTheme } from '@/contexts';
import type { Mode } from '@/types';

import { SelectPrompt, SelectPromptHint } from '../SelectPrompt';

interface Props {
  planContent: string;
  onModeChange: (mode: Mode) => void;
}

const options = [
  { label: 'Approve in auto mode', value: MODE.AUTO },
  { label: 'Approve in safe mode', value: MODE.SAFE },
  { label: 'Continue planning', value: MODE.PLAN },
];

export function PlanReview({ planContent, onModeChange }: Props) {
  const theme = useTheme();
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
            <Markdown content={planContent} />
          </Box>

          <SelectPromptHint message="Select review action" />
        </Box>
      </SelectPrompt>
    </Box>
  );
}
