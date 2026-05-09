import { Box, Text, useApp, useInput } from 'ink';
import { useCallback, useRef, useState } from 'react';

import { COMMAND, UI } from '../../constants';
import { time } from '../../utils';
import { TextInput } from '../TextInput';
import { CommandMenu } from './CommandMenu';
import { FileSuggestions } from './FileSuggestions';

interface Props {
  isDisabled?: boolean;
  onInterrupt?: () => void;
  onSubmit: (value: string) => void;
}

function hasFileSuggestionQuery(input: string): boolean {
  // e.g.: @file
  return /(^|\s)@\S+$/.test(input);
}

export function Input({ isDisabled = false, onInterrupt, onSubmit }: Props) {
  const { exit } = useApp();
  const [input, setInput] = useState('');
  const fileSuggestionRef = useRef<string | null>(null);

  const resetInput = useCallback(() => {
    setInput('');
  }, []);

  const handleSelectFileSuggestion = useCallback((nextInput: string) => {
    setInput(nextInput);
  }, []);

  const handleFileSuggestionChange = useCallback((nextInput: string | null) => {
    fileSuggestionRef.current = nextInput;
  }, []);

  const submitAndReset = useCallback(
    (input: string) => {
      const trimmedInput = input.trim();
      if (!trimmedInput) {
        return;
      }

      onSubmit(trimmedInput);
      resetInput();
      fileSuggestionRef.current = null;
    },
    [onSubmit, resetInput],
  );

  const showCommandMenu = input.startsWith('/');
  const showFileSuggestions = !showCommandMenu && hasFileSuggestionQuery(input);

  const handleSubmitText = useCallback(
    async (input: string) => {
      await time.tick();

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

  useInput((_input, key) => {
    const isCtrlC = key.ctrl && _input === 'c';

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
  });

  return (
    <Box flexDirection="column">
      <Box>
        <Text>{UI.PROMPT_PREFIX}</Text>

        <TextInput
          value={input}
          isDisabled={isDisabled}
          onChange={setInput}
          // eslint-disable-next-line @typescript-eslint/no-misused-promises
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
