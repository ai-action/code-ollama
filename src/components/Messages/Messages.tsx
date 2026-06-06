import { Box, Static } from 'ink';

import { UI } from '@/constants';
import type { Message as OllamaMessage } from '@/utils/ollama';

import { TURN_ABORTED_MESSAGE } from './constants';
import { Message } from './Message';
import { ThinkingSpinner } from './ThinkingSpinner';

interface Props {
  messages: OllamaMessage[];
  isLoading: boolean;
  sessionId: string;
  streamingMessage?: OllamaMessage | null;
}

export function Messages({
  messages,
  isLoading,
  sessionId,
  streamingMessage,
}: Props) {
  const transcriptMessages = messages.filter(
    ({ content }) => content !== TURN_ABORTED_MESSAGE,
  );

  return (
    <>
      <Static key={sessionId} items={transcriptMessages}>
        {(message, index) => <Message key={index} message={message} />}
      </Static>

      {streamingMessage && <Message isStreaming message={streamingMessage} />}

      {isLoading && streamingMessage && !streamingMessage.content && (
        <Box marginTop={-1} marginBottom={1} marginX={UI.AGENT_MARGIN_X}>
          <ThinkingSpinner />
        </Box>
      )}
    </>
  );
}
