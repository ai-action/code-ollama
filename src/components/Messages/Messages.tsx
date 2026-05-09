import { Spinner } from '@inkjs/ui';
import { Box, Text } from 'ink';
import { memo } from 'react';

import { ROLE, UI } from '../../constants';
import type { ollama } from '../../utils';
import { TURN_ABORTED_MESSAGE } from './constants';

interface Props {
  messages: ollama.Message[];
  isLoading: boolean;
  streamingMessage?: ollama.Message | null;
}

function getMessageColor(role: string): string | undefined {
  switch (role) {
    case ROLE.USER:
      return 'black';
    case ROLE.ASSISTANT:
      return 'blue';
    case ROLE.SYSTEM:
      return 'gray';
    default:
      return undefined;
  }
}

interface MessageProps {
  message: ollama.Message;
}

const Message = memo(function Message({ message }: MessageProps) {
  return (
    <Box marginBottom={1}>
      <Text
        color={getMessageColor(message.role)}
        dimColor={message.role === ROLE.SYSTEM}
      >
        {message.role === ROLE.USER && UI.PROMPT_PREFIX}
        {message.content}
      </Text>
    </Box>
  );
});

export function Messages({ messages, isLoading, streamingMessage }: Props) {
  return (
    <Box flexDirection="column">
      {messages
        .filter(({ content }) => content !== TURN_ABORTED_MESSAGE)
        .map((message, index) => (
          <Message key={index} message={message} />
        ))}

      {streamingMessage && <Message message={streamingMessage} />}

      {isLoading && !streamingMessage?.content && (
        <Box marginTop={-1} marginBottom={1}>
          <Spinner label="Thinking..." />
        </Box>
      )}
    </Box>
  );
}
