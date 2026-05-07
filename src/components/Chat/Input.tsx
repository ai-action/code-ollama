import { TextInput } from '@inkjs/ui';
import { Box, Text } from 'ink';
import { useCallback, useState } from 'react';

import { COMMAND, UI } from '../../constants';
import { CommandMenu } from './CommandMenu';

interface Props {
  isDisabled?: boolean;
  onSubmit: (value: string) => void;
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

  return (
    <Box flexDirection="column">
      <Box>
        <Text>{UI.PROMPT_PREFIX}</Text>

        <TextInput
          isDisabled={isDisabled}
          key={resetKey}
          onChange={setInput}
          onSubmit={handleSubmitText}
        />
      </Box>

      {input.startsWith('/') && (
        <CommandMenu input={input} onSubmit={handleSubmitCommand} />
      )}
    </Box>
  );
}
