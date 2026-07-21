import { Box, Text } from 'ink';
import { useCallback, useMemo } from 'react';

import { Markdown } from '@/components/Markdown';
import { UI } from '@/constants';
import { useTheme } from '@/contexts';
import type { PlanQuestion } from '@/types';

import { SelectPrompt, SelectPromptHint } from '../SelectPrompt';

interface Props {
  planContent: string;
  question: PlanQuestion;
  onAnswer: (answer: string) => void;
  onCustom: () => void;
}

const CUSTOM_RESPONSE = 'custom';

export function PlanClarification({
  planContent,
  question,
  onAnswer,
  onCustom,
}: Props) {
  const theme = useTheme();
  const options = useMemo(
    () => [
      ...question.options.map((label, index) => ({
        label,
        value: String(index),
      })),
      { label: 'Type a custom response', value: CUSTOM_RESPONSE },
    ],
    [question.options],
  );
  const handleChange = useCallback(
    (value: string) => {
      if (value === CUSTOM_RESPONSE) {
        onCustom();
        return;
      }

      onAnswer(question.options[Number(value)]);
    },
    [onAnswer, onCustom, question.options],
  );

  return (
    <Box marginX={UI.SCREEN_MARGIN_X}>
      <SelectPrompt
        borderStyle="bold"
        options={options}
        onChange={handleChange}
        onCancel={onCustom}
      >
        <Box flexDirection="column">
          <Text bold color={theme.colors.accent}>
            Plan Clarification - Choose an answer:
          </Text>

          <Box marginY={1}>
            <Markdown content={planContent} />
          </Box>

          <SelectPromptHint message="Select an answer" />
        </Box>
      </SelectPrompt>
    </Box>
  );
}
