import { Box, Text, useInput } from 'ink';
import { useEffect, useState } from 'react';

import { KEY } from '@/constants';

const DEFAULT_MAX_VISIBLE_OPTIONS = 5;

export interface SuggestionOption<T = string> {
  label: string;
  value: T;
}

interface Props<T = string> {
  options: SuggestionOption<T>[];
  isDisabled?: boolean;
  maxVisibleOptions?: number;
  resetKey?: string;
  onHighlight?: (option: SuggestionOption<T> | null) => void;
  onSelect: (option: SuggestionOption<T>) => void;
}

export function Suggestions<T = string>({
  options,
  isDisabled = false,
  maxVisibleOptions = DEFAULT_MAX_VISIBLE_OPTIONS,
  resetKey,
  onHighlight,
  onSelect,
}: Props<T>) {
  const [focusedIndex, setFocusedIndex] = useState(0);

  useEffect(() => {
    setFocusedIndex(0);
  }, [resetKey]);

  useEffect(() => {
    if (!options.length) {
      setFocusedIndex(0);
      onHighlight?.(null);
      return;
    }

    setFocusedIndex((currentIndex) =>
      Math.min(currentIndex, options.length - 1),
    );
  }, [onHighlight, options]);

  useEffect(() => {
    onHighlight?.(options[focusedIndex] ?? null);
  }, [focusedIndex, onHighlight, options]);

  useInput((input, key) => {
    if (isDisabled || !options.length) {
      return;
    }

    if (key.downArrow || input === KEY.DOWN) {
      setFocusedIndex((currentIndex) =>
        Math.min(currentIndex + 1, options.length - 1),
      );
      return;
    }

    if (key.upArrow || input === KEY.UP) {
      setFocusedIndex((currentIndex) => Math.max(currentIndex - 1, 0));
      return;
    }

    if (key.tab || key.return) {
      onSelect(options[focusedIndex]);
    }
  });

  if (!options.length) {
    return null;
  }

  const visibleStart = Math.min(
    Math.max(0, focusedIndex - maxVisibleOptions + 1),
    Math.max(0, options.length - maxVisibleOptions),
  );
  const visibleOptions = options.slice(
    visibleStart,
    visibleStart + maxVisibleOptions,
  );

  return (
    <Box flexDirection="column">
      {visibleOptions.map((option, index) => {
        const optionIndex = visibleStart + index;
        const isFocused = optionIndex === focusedIndex;

        return (
          <Box key={option.label} marginLeft={2}>
            <Text color={isFocused ? 'cyan' : undefined}>{option.label}</Text>
          </Box>
        );
      })}
    </Box>
  );
}
