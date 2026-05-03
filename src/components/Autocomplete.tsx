import { TextInput } from '@inkjs/ui';
import { Box, Text, useInput } from 'ink';
import { useCallback, useState } from 'react';

import { type Command, COMMANDS, UI } from '../constants';

interface Props {
  isDisabled?: boolean;
  onSubmit: (value: string) => void;
}

function getMatches(input: string): Command[] {
  if (!input.startsWith('/')) {
    return [];
  }
  return COMMANDS.filter((command) => command.name.startsWith(input));
}

export function Autocomplete({ isDisabled = false, onSubmit }: Props) {
  const [value, setValue] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [inputKey, setInputKey] = useState(0);

  const matches = getMatches(value);
  const isCommandMode = value.startsWith('/');

  useInput(
    (_char, key) => {
      // v8 ignore next
      if (!isCommandMode) {
        return;
      }

      if (key.upArrow) {
        setSelectedIndex((i) => Math.max(0, i - 1));
        return;
      }

      if (key.downArrow) {
        setSelectedIndex((i) => Math.min(matches.length - 1, i + 1));
        return;
      }

      if (key.tab && matches.length > 0) {
        // v8 ignore next
        const match = matches[selectedIndex] ?? matches[0];
        setValue(match.name);
        setSelectedIndex(0);
        setInputKey((key) => key + 1);
        return;
      }
    },
    { isActive: !isDisabled && isCommandMode },
  );

  const handleSubmit = useCallback(
    (input: string) => {
      const submitValue =
        isCommandMode && matches.length > 0 && matches[selectedIndex]
          ? matches[selectedIndex].name
          : input;
      const trimmed = submitValue.trim();
      if (trimmed) {
        onSubmit(trimmed);
        setValue('');
        setSelectedIndex(0);
        setInputKey((key) => key + 1);
      }
    },
    [isCommandMode, matches, onSubmit, selectedIndex],
  );

  return (
    <Box flexDirection="column">
      <Box>
        <Text>{UI.PROMPT_PREFIX}</Text>
        <TextInput
          key={inputKey}
          isDisabled={isDisabled}
          defaultValue={value}
          onChange={setValue}
          onSubmit={handleSubmit}
        />
      </Box>

      {isCommandMode && matches.length > 0 && (
        <Box flexDirection="column" marginLeft={2}>
          {matches.map((command, index) => {
            const isHighlighted = index === selectedIndex;
            return (
              <Box key={command.name} gap={1}>
                <Text
                  color={isHighlighted ? 'cyan' : undefined}
                  bold={isHighlighted}
                >
                  {command.name}
                </Text>
                <Text dimColor>{command.description}</Text>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
