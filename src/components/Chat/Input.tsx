import { TextInput } from '@inkjs/ui';
import { Box, Text, useApp, useInput } from 'ink';
import { useCallback, useState } from 'react';

import { COMMAND, UI } from '../../constants';
import { time } from '../../utils';
import { CommandMenu } from './CommandMenu';
import { FileSuggestions } from './FileSuggestions';

interface Props {
  isDisabled?: boolean;
  onSubmit: (value: string) => void;
}

function hasActiveMentionQuery(input: string): boolean {
  return /(^|\s)@\S+$/.test(input);
}

export function Input({ isDisabled = false, onSubmit }: Props) {
  const { exit } = useApp();
  const [input, setInput] = useState('');
  const [inputKey, setInputKey] = useState(0);

  const remountTextInput = useCallback(() => {
    setInputKey((key) => key + 1);
  }, [setInputKey]);

  const handleSubmitText = useCallback(
    async (input: string) => {
      await time.tick();

      if (input.startsWith('/')) {
        return;
      }

      const trimmedInput = input.trim();
      if (!trimmedInput) {
        return;
      }

      onSubmit(trimmedInput);
      setInput('');
      remountTextInput();
    },
    [onSubmit, remountTextInput],
  );

  const handleSubmitCommand = useCallback(
    (input: string) => {
      if (!COMMAND.LIST.find(({ name }) => name === input)) {
        return;
      }

      onSubmit(input);
      setInput('');
      remountTextInput();
    },
    [onSubmit, remountTextInput],
  );

  const handleSelectFileSuggestion = useCallback(
    (nextInput: string) => {
      setInput(nextInput);
      remountTextInput();
    },
    [remountTextInput],
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

  const showCommandMenu = input.startsWith('/');
  const showFileSuggestions = !showCommandMenu && hasActiveMentionQuery(input);

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
          onSelect={handleSelectFileSuggestion}
        />
      )}
    </Box>
  );
}
