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
  const [resetKey, setResetKey] = useState(0);

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
      setResetKey((key) => key + 1);
    },
    [onSubmit],
  );

  const handleSubmitCommand = useCallback(
    (input: string) => {
      if (!COMMAND.LIST.find(({ name }) => name === input)) {
        return;
      }

      onSubmit(input);
      setInput('');
      setResetKey((key) => key + 1);
    },
    [onSubmit],
  );

  const handleSelectFileSuggestion = useCallback((nextInput: string) => {
    setInput(nextInput);
    setResetKey((key) => key + 1);
  }, []);

  useInput((_input, key) => {
    if (key.ctrl && _input === 'c') {
      if (input) {
        setInput('');
        setResetKey((key) => key + 1);
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
          key={resetKey}
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
