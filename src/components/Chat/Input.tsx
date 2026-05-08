import { TextInput } from '@inkjs/ui';
import { Box, Text, useApp, useInput } from 'ink';
import { useCallback, useRef, useState } from 'react';

import { COMMAND, UI } from '../../constants';
import { time } from '../../utils';
import { CommandMenu } from './CommandMenu';
import { FileSuggestions } from './FileSuggestions';

interface Props {
  isDisabled?: boolean;
  onSubmit: (value: string) => void;
}

function hasFileSuggestionQuery(input: string): boolean {
  // e.g.: @file
  return /(^|\s)@\S+$/.test(input);
}

export function Input({ isDisabled = false, onSubmit }: Props) {
  const { exit } = useApp();
  const [input, setInput] = useState('');
  const [inputKey, setInputKey] = useState(0);
  const fileSuggestionRef = useRef<string | null>(null);

  const remountTextInput = useCallback(() => {
    setInputKey((key) => key + 1);
  }, [setInputKey]);

  const handleSelectFileSuggestion = useCallback(
    (nextInput: string) => {
      setInput(nextInput);
      remountTextInput();
    },
    [remountTextInput],
  );

  const handleFileSuggestionChange = useCallback((nextInput: string | null) => {
    fileSuggestionRef.current = nextInput;
  }, []);

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

      const trimmedInput = input.trim();
      if (!trimmedInput) {
        return;
      }

      onSubmit(trimmedInput);
      setInput('');
      fileSuggestionRef.current = null;
      remountTextInput();
    },
    [handleSelectFileSuggestion, onSubmit, remountTextInput],
  );

  const handleSubmitCommand = useCallback(
    (input: string) => {
      if (!COMMAND.LIST.find(({ name }) => name === input)) {
        return;
      }

      onSubmit(input);
      setInput('');
      fileSuggestionRef.current = null;
      remountTextInput();
    },
    [onSubmit, remountTextInput],
  );

  useInput((_input, key) => {
    if (key.ctrl && _input === 'c') {
      if (input) {
        setInput('');
        remountTextInput();
      } else {
        exit();
      }
    }
  });

  return (
    <Box flexDirection="column">
      <Box>
        <Text>{UI.PROMPT_PREFIX}</Text>

        <TextInput
          defaultValue={input}
          isDisabled={isDisabled}
          key={inputKey}
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
