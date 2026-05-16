import { Box, Text, useApp, useInput } from 'ink';
import { useCallback, useEffect, useRef, useState } from 'react';

import { COMMAND, UI } from '../../constants';
import { TextInput } from '../TextInput';
import { CommandMenu } from './CommandMenu';
import { FileSuggestions } from './FileSuggestions';

interface Props {
  history: string[];
  isDisabled?: boolean;
  onInterrupt?: () => void;
  onSubmit: (value: string) => void;
}

interface FileSuggestionRef {
  value: string;
  cursorPosition: number;
}

function hasFileSuggestionQuery(input: string): boolean {
  // e.g.: `@file`, `see @file`, `see@file`, or `@file see`
  return /(^|.)@\S+/.test(input);
}

export function Input({
  history: sessionHistory,
  isDisabled = false,
  onInterrupt,
  onSubmit,
}: Props) {
  const { exit } = useApp();
  const [history, setHistory] = useState(sessionHistory);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [input, setInput] = useState('');
  const [cursorPosition, setCursorPosition] = useState<number | undefined>(
    undefined,
  );
  const fileSuggestionRef = useRef<FileSuggestionRef | null>(null);

  useEffect(() => {
    setHistory(sessionHistory);
    setHistoryIndex(null);
    setInput('');
    setCursorPosition(undefined);
    fileSuggestionRef.current = null;
  }, [sessionHistory]);

  const resetInput = useCallback(() => {
    setInput('');
    setCursorPosition(undefined);
    setHistoryIndex(null);
  }, []);

  const handleSelectFileSuggestion = useCallback(
    (nextInput: FileSuggestionRef) => {
      setInput(nextInput.value);
      setCursorPosition(nextInput.cursorPosition);
    },
    [],
  );

  const handleFileSuggestionChange = useCallback(
    (nextInput: string | null) => {
      // Calculate cursor position: end of the file path (before any suffix)
      if (nextInput) {
        // Find where the suffix starts (after the inserted file path)
        // Cursor position is right after the inserted file path
        const mentionMatch = /(^|.)@(\S+)/.exec(input);

        // v8 ignore start
        if (mentionMatch) {
          const prefixLength = mentionMatch.index + mentionMatch[1].length;
          const queryLength = mentionMatch[2].length;
          const suffix = input.slice(prefixLength + 1 + queryLength);

          // Cursor is at end of nextInput minus suffix length
          const cursorPosition = nextInput.length - suffix.length;
          fileSuggestionRef.current = { value: nextInput, cursorPosition };
        } else {
          fileSuggestionRef.current = {
            value: nextInput,
            cursorPosition: nextInput.length,
          };
        }
        // v8 ignore stop
      } else {
        fileSuggestionRef.current = null;
      }
    },
    [input],
  );

  const handleInputChange = useCallback((nextInput: string) => {
    setInput(nextInput);
    setHistoryIndex(null);
  }, []);

  const submitAndReset = useCallback(
    (input: string) => {
      const trimmedInput = input.trim();
      if (!trimmedInput) {
        return;
      }

      onSubmit(trimmedInput);
      if (!trimmedInput.startsWith('/')) {
        setHistory((previousHistory) => [...previousHistory, trimmedInput]);
      }
      resetInput();
      fileSuggestionRef.current = null;
    },
    [onSubmit, resetInput],
  );

  const showCommandMenu = input.startsWith('/');
  const showFileSuggestions = !showCommandMenu && hasFileSuggestionQuery(input);

  const handleHistoryNavigation = useCallback(
    (direction: 'up' | 'down') => {
      if (!history.length || showFileSuggestions) {
        return;
      }

      if (direction === 'up') {
        if (historyIndex === null) {
          if (input) {
            return;
          }

          const nextIndex = history.length - 1;
          const nextInput = history[nextIndex];
          setHistoryIndex(nextIndex);
          setInput(nextInput);
          setCursorPosition(nextInput.length);
          return;
        }

        if (historyIndex === 0) {
          return;
        }

        const nextIndex = historyIndex - 1;
        const nextInput = history[nextIndex];
        setHistoryIndex(nextIndex);
        setInput(nextInput);
        setCursorPosition(nextInput.length);
        return;
      }

      if (historyIndex === null) {
        return;
      }

      if (historyIndex === history.length - 1) {
        setHistoryIndex(null);
        setInput('');
        setCursorPosition(0);
        return;
      }

      const nextIndex = historyIndex + 1;
      const nextInput = history[nextIndex];
      setHistoryIndex(nextIndex);
      setInput(nextInput);
      setCursorPosition(nextInput.length);
    },
    [history, historyIndex, input, showFileSuggestions],
  );

  const handleSubmitText = useCallback(
    (input: string) => {
      if (input.startsWith('/')) {
        return;
      }

      if (hasFileSuggestionQuery(input)) {
        if (fileSuggestionRef.current) {
          handleSelectFileSuggestion(fileSuggestionRef.current);
        }

        return;
      }

      submitAndReset(input);
    },
    [handleSelectFileSuggestion, submitAndReset],
  );

  const handleSubmitCommand = useCallback(
    (input: string) => {
      if (COMMAND.LIST.find(({ name }) => name === input)) {
        submitAndReset(input);
      }
    },
    [submitAndReset],
  );

  useInput((inputKey, key) => {
    const isCtrlC = key.ctrl && inputKey === 'c';

    if (isDisabled) {
      if (key.escape || isCtrlC) {
        onInterrupt?.();
      }
      return;
    }

    if (isCtrlC) {
      if (input) {
        resetInput();
        return;
      }

      exit();
    }

    if (key.upArrow) {
      handleHistoryNavigation('up');
      return;
    }

    if (key.downArrow) {
      handleHistoryNavigation('down');
    }
  });

  return (
    <Box flexDirection="column">
      <Box>
        <Text>{UI.PROMPT_PREFIX}</Text>

        <TextInput
          value={input}
          isDisabled={isDisabled}
          cursorPosition={cursorPosition}
          wrapIndent={UI.PROMPT_PREFIX.length}
          onChange={handleInputChange}
          onSubmit={handleSubmitText}
          placeholder="Ask anything... (/ commands, @ files)"
        />
      </Box>

      {showCommandMenu && (
        <CommandMenu input={input} onSubmit={handleSubmitCommand} />
      )}

      {showFileSuggestions && (
        <FileSuggestions
          input={input}
          isDisabled={isDisabled}
          onChange={handleFileSuggestionChange}
          onSelect={handleSelectFileSuggestion}
        />
      )}
    </Box>
  );
}
