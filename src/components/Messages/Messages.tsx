import { Spinner } from '@inkjs/ui';
import { Box, Static, Text, useStdout } from 'ink';
import { useRef } from 'react';

import { ROLE, THEME, UI } from '../../constants';
import type { ThemeDefinition } from '../../types';
import type { Message as OllamaMessage } from '../../utils/ollama';
import { CodeBlock } from '../CodeBlock';
import { Markdown } from '../Markdown';
import { TURN_ABORTED_MESSAGE } from './constants';
import {
  getAssistantContentWidth,
  getCodeBlockHeight,
  getStreamingTextHeight,
} from './layout';
import { parseContent, unwrapRawMarkdownFence } from './parsing';
import { splitStreamingInlineContent } from './streaming';
import { getMessageColor } from './styles';

interface Props {
  messages: OllamaMessage[];
  isLoading: boolean;
  sessionId: string;
  streamingMessage?: OllamaMessage | null;
  theme?: ThemeDefinition;
}

interface MessageProps {
  message: OllamaMessage;
  isStreaming?: boolean;
  theme: ThemeDefinition;
}

export function Message({ message, isStreaming = false, theme }: MessageProps) {
  const { stdout } = useStdout();
  const messageColor = getMessageColor(message.role, theme);
  const isSystem = message.role === ROLE.SYSTEM;
  const isUser = message.role === ROLE.USER;
  const isStreamingAssistant = isStreaming && !isUser && !isSystem;
  const stickyHeightRef = useRef<{
    columns: number;
    maxHeight: number;
  }>({
    columns: stdout.columns,
    maxHeight: 0,
  });

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
  const availableWidth = getAssistantContentWidth(stdout.columns);

  if (stickyHeightRef.current.columns !== stdout.columns) {
    stickyHeightRef.current = {
      columns: stdout.columns,
      maxHeight: 0,
    };
  }

  const streamingHeight = isStreamingAssistant
    ? segments.reduce((height, segment) => {
        if (segment.type === 'code') {
          return height + getCodeBlockHeight(segment.content, availableWidth);
        }

        if (segment.type === 'raw') {
          const markdownSource = unwrapRawMarkdownFence(segment.content);
          return (
            height +
            getCodeBlockHeight(
              markdownSource ?? segment.content,
              availableWidth,
            )
          );
        }

        const textParts = splitStreamingInlineContent(segment.content);
        return height + getStreamingTextHeight(textParts, availableWidth);
      }, 0)
    : 0;

  if (isStreamingAssistant) {
    stickyHeightRef.current.maxHeight = Math.max(
      stickyHeightRef.current.maxHeight,
      streamingHeight,
    );
  }
  const stickyPaddingLines = isStreamingAssistant
    ? stickyHeightRef.current.maxHeight - streamingHeight
    : 0;

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
                theme={theme}
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
                theme={theme}
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
                  theme={theme}
                />
              ),
            )}
          </Box>
        );
      })}

      {Array.from({ length: stickyPaddingLines }, (_, index) => (
        <Text key={'padding-' + String(index)}> </Text>
      ))}
    </Box>
  );
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
