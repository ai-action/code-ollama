import { Spinner } from '@inkjs/ui';
import { Box, Static, Text } from 'ink';
import { memo } from 'react';

import { ROLE, UI } from '../../constants';
import type { Message as OllamaMessage } from '../../utils/ollama';
import {
  CODE_BLOCK_REGEX,
  CodeBlock,
  normalizeCodeBlockContent,
} from '../CodeBlock';
import { Markdown } from '../Markdown';
import { TURN_ABORTED_MESSAGE } from './constants';
import { splitStreamingInlineContent } from './utils';

interface Props {
  messages: OllamaMessage[];
  isLoading: boolean;
  sessionId?: string | number;
  streamingMessage?: OllamaMessage | null;
}

function getMessageColor(role: string): string | undefined {
  switch (role) {
    case ROLE.USER:
      return 'black';
    case ROLE.ASSISTANT:
      return 'cyan';
    case ROLE.SYSTEM:
      return 'gray';
    default:
      return undefined;
  }
}

interface ContentSegment {
  type: 'text' | 'code';
  content: string;
  language?: string;
}

function parseContent(content: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  let lastIndex = 0;
  let match;
  CODE_BLOCK_REGEX.lastIndex = 0;

  while ((match = CODE_BLOCK_REGEX.exec(content)) !== null) {
    // Add text before code block
    if (match.index > lastIndex) {
      const textContent = content.slice(lastIndex, match.index).trim();
      // v8 ignore next 2 - Defensive check for empty trimmed content
      if (textContent) {
        segments.push({ type: 'text', content: textContent });
      }
    }

    // Add code block
    const indent = match[1];
    const language = match[3];
    const codeContent = normalizeCodeBlockContent(match[4], indent);
    // v8 ignore next 2 - Defensive check for empty code block
    if (codeContent) {
      segments.push({ type: 'code', content: codeContent, language });
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after last code block
  if (lastIndex < content.length) {
    const textContent = content.slice(lastIndex).trim();
    // v8 ignore next 2 - Defensive check for empty trimmed content
    if (textContent) {
      segments.push({ type: 'text', content: textContent });
    }
  }

  // If no code blocks found, return the whole content as text
  // v8 ignore next 2 - Defensive fallback for edge case
  if (!segments.length && content.trim()) {
    segments.push({ type: 'text', content: content.trim() });
  }

  return segments;
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
  sessionId = 0,
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
