import { Box, Text, useInput } from 'ink';
import { useState } from 'react';

import { type Command, COMMANDS, UI } from '../constants';

interface Props {
  isDisabled?: boolean;
  onSubmit: (value: string) => void;
}

function getMatches(input: string): Command[] {
  if (!input.startsWith('/')) return [];
  return COMMANDS.filter((cmd) => cmd.name.startsWith(input));
}

export function Autocomplete({ isDisabled = false, onSubmit }: Props) {
  const [value, setValue] = useState('');
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
        setValue((v) => v.slice(0, -1));
        setSelectedIndex(0);
        return;
      }

      // v8 ignore next
      if (char && !key.ctrl && !key.meta) {
        setValue((v) => {
          const next = v + char;
          setSelectedIndex(0);
          return next;
        });
      }
    },
    { isActive: !isDisabled },
  );

  return (
    <Box flexDirection="column">
      <Box>
        <Text>{UI.PROMPT_PREFIX}</Text>
        <Text>{value}</Text>
      </Box>

      {showSuggestions && (
        <Box flexDirection="column">
          {matches.map((cmd, index) => {
            const isHighlighted = index === selectedIndex;
            return (
              <Box key={cmd.name} gap={1}>
                <Text
                  color={isHighlighted ? 'cyan' : undefined}
                  bold={isHighlighted}
                >
                  {cmd.name}
                </Text>
                <Text dimColor>{cmd.description}</Text>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
