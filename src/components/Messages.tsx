import { Spinner } from '@inkjs/ui';
import { Box, Text } from 'ink';

import { ROLE, UI } from '../constants';
import type { ollama } from '../utils';

interface Props {
  messages: ollama.Message[];
  isLoading: boolean;
}

export function Messages({ messages, isLoading }: Props) {
  return (
    <Box flexDirection="column">
      {messages.map((message, index) => (
        <Box key={index} marginBottom={1}>
          <Text color={message.role === ROLE.USER ? 'black' : 'blue'}>
            {message.role === ROLE.USER ? UI.PROMPT_PREFIX : ''}
            {message.content}
          </Text>
        </Box>
      ))}

      {isLoading && messages[messages.length - 1]?.content === '' && (
        <Box marginTop={-1} marginBottom={1}>
          <Spinner label="Thinking..." />
        </Box>
      )}
    </Box>
  );
}
