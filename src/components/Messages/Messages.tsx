import { Spinner } from '@inkjs/ui';
import { Box, Static } from 'ink';

import { THEME, UI } from '@/constants';
import type { ThemeDefinition } from '@/types';
import type { Message as OllamaMessage } from '@/utils/ollama';

import { TURN_ABORTED_MESSAGE } from './constants';
import { Message } from './Message';

interface Props {
  messages: OllamaMessage[];
  isLoading: boolean;
  sessionId: string;
  streamingMessage?: OllamaMessage | null;
  theme?: ThemeDefinition;
}

export function Messages({
  messages,
  isLoading,
  sessionId,
  streamingMessage,
  theme = THEME.getTheme(),
}: Props) {
  const transcriptMessages = messages.filter(
    ({ content }) => content !== TURN_ABORTED_MESSAGE,
  );

  return (
    <Box flexDirection="column">
      <Static key={sessionId} items={transcriptMessages}>
        {(message, index) => (
          <Message key={index} message={message} theme={theme} />
        )}
      </Static>

      {streamingMessage && (
        <Message isStreaming message={streamingMessage} theme={theme} />
      )}

      {isLoading && !streamingMessage?.content && (
        <Box marginTop={-1} marginBottom={1} marginX={UI.AGENT_MARGIN_X}>
          <Spinner label="Thinking..." />
        </Box>
      )}
    </Box>
  );
}
