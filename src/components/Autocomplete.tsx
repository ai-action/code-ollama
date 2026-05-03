import { Box, Text, useInput } from 'ink';
import { useState } from 'react';

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
  const [cursorPosition, setCursorPosition] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const matches = getMatches(value);
  const showSuggestions = matches.length > 0;

  useInput(
    (char, key) => {
      if (key.upArrow) {
        setSelectedIndex((i) => Math.max(0, i - 1));
        return;
      }

      if (key.downArrow) {
        setSelectedIndex((i) => Math.min(matches.length - 1, i + 1));
        return;
      }

      // v8 ignore next 4
      if (key.leftArrow) {
        setCursorPosition((position) => Math.max(0, position - 1));
        return;
      }

      // v8 ignore next 4
      if (key.rightArrow) {
        setCursorPosition((position) => Math.min(value.length, position + 1));
        return;
      }

      if (key.tab && showSuggestions) {
        // v8 ignore next
        const match = matches[selectedIndex] ?? matches[0];
        setValue(match.name);
        setSelectedIndex(0);
        return;
      }

      if (key.return) {
        const submitValue =
          showSuggestions && selectedIndex >= 0 && matches[selectedIndex]
            ? matches[selectedIndex].name
            : value;
        const trimmed = submitValue.trim();
        if (trimmed) {
          onSubmit(trimmed);
          setValue('');
          setSelectedIndex(0);
        }
        return;
      }

      if (key.escape) {
        setValue('');
        setSelectedIndex(0);
        return;
      }

      if (key.backspace || key.delete) {
        setValue((value) => {
          const before = value.slice(0, cursorPosition - 1);
          const after = value.slice(cursorPosition);
          return before + after;
        });
        setCursorPosition((position) => Math.max(0, position - 1));
        setSelectedIndex(0);
        return;
      }

      // v8 ignore next
      if (char && !key.ctrl && !key.meta) {
        setValue((value) => {
          const before = value.slice(0, cursorPosition);
          const after = value.slice(cursorPosition);
          return before + char + after;
        });
        setCursorPosition((position) => position + 1);
        setSelectedIndex(0);
      }
    },
    { isActive: !isDisabled },
  );

  return (
    <Box flexDirection="column">
      <Box>
        <Text>{UI.PROMPT_PREFIX}</Text>

        <Text>
          {value.slice(0, cursorPosition)}
          {cursorPosition < value.length ? (
            <Text backgroundColor="black" color="white">
              {value[cursorPosition]}
            </Text>
          ) : (
            <Text backgroundColor="black" color="white">
              {' '}
            </Text>
          )}
          {value.slice(cursorPosition + 1)}
        </Text>
      </Box>

      {showSuggestions && (
        <Box flexDirection="column">
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
