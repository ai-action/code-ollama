import { Spinner } from '@inkjs/ui';
import { Box, Static, Text } from 'ink';
import { memo } from 'react';

import { ROLE, UI } from '../../constants';
import type { Message as OllamaMessage } from '../../utils/ollama';
import { CodeBlock } from '../CodeBlock';
import { Markdown } from '../Markdown';
import { TURN_ABORTED_MESSAGE } from './constants';
import {
  getMessageColor,
  parseContent,
  splitStreamingInlineContent,
  unwrapRawMarkdownFence,
} from './utils';

interface Props {
  messages: OllamaMessage[];
  isLoading: boolean;
  sessionId: string;
  streamingMessage?: OllamaMessage | null;
}

interface MessageProps {
  message: OllamaMessage;
  isStreaming?: boolean;
}

export const Message = memo(function Message({
  message,
  isStreaming = false,
}: MessageProps) {
  const messageColor = getMessageColor(message.role);
  const isSystem = message.role === ROLE.SYSTEM;
  const isUser = message.role === ROLE.USER;

  // System messages: render raw content (preserves backticks, no parsing)
  if (isSystem) {
    return (
      <Box flexDirection="column" marginBottom={1} marginX={UI.AGENT_MARGIN_X}>
        <Text color={messageColor} dimColor>
          {message.content}
        </Text>
      </Box>
    );
  }

  const segments = parseContent(message.content);

  return (
    <Box flexDirection="column" marginBottom={1}>
      {segments.map((segment, index) => {
        const isFirstSegment = index === 0;
        const prefix = isUser && isFirstSegment ? UI.PROMPT_PREFIX : '';

        // Code blocks: only render for assistant
        if (segment.type === 'code') {
          return isUser ? (
            <Text key={index} color={messageColor}>
              {segment.content}
            </Text>
          ) : (
            <Box key={index} marginX={UI.AGENT_MARGIN_X}>
              <CodeBlock
                code={segment.content}
                language={segment.language}
                role={message.role}
              />
            </Box>
          );
        }

        if (segment.type === 'raw') {
          const markdownSource = unwrapRawMarkdownFence(segment.content);
          return (
            <Box key={index} marginX={UI.AGENT_MARGIN_X}>
              <CodeBlock
                code={markdownSource ?? segment.content}
                language={markdownSource ? 'markdown' : segment.language}
                role={message.role}
              />
            </Box>
          );
        }

        const textParts =
          isStreaming && !isUser
            ? splitStreamingInlineContent(segment.content)
            : ([{ type: 'markdown', content: segment.content }] as const);

        // Text: User = plain text, Assistant = markdown
        return isUser ? (
          <Text key={index} color={messageColor}>
            {prefix + segment.content}
          </Text>
        ) : (
          <Box key={index} flexDirection="column" marginX={UI.AGENT_MARGIN_X}>
            {textParts.map((part, partIndex) =>
              part.type === 'plain' ? (
                <Text key={partIndex} color={messageColor}>
                  {part.content}
                </Text>
              ) : (
                <Markdown
                  key={partIndex}
                  content={part.content}
                  color={messageColor}
                />
              ),
            )}
          </Box>
        );
      })}
    </Box>
  );
});

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
    <Box flexDirection="column">
      <Static key={sessionId} items={transcriptMessages}>
        {(message, index) => <Message key={index} message={message} />}
      </Static>

      {streamingMessage && <Message isStreaming message={streamingMessage} />}

      {isLoading && !streamingMessage?.content && (
        <Box marginTop={-1} marginBottom={1} marginX={UI.AGENT_MARGIN_X}>
          <Spinner label="Thinking..." />
        </Box>
      )}
    </Box>
  );
}
