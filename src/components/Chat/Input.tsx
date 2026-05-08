import { TextInput } from '@inkjs/ui';
import { Box, Text } from 'ink';
import { useCallback, useState } from 'react';

import { COMMAND, UI } from '../../constants';
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
  const [input, setInput] = useState('');
  const [resetKey, setResetKey] = useState(0);

  const handleSubmitText = useCallback(
    (input: string) => {
      setTimeout(() => {
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
      });
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
          onSubmit={handleSubmitText}
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
