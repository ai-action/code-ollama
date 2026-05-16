import { Box, Text, useStdout } from 'ink';
import { useRef } from 'react';

import { CodeBlock } from '@/components/CodeBlock';
import { Markdown } from '@/components/Markdown';
import { ROLE, UI } from '@/constants';
import type { ThemeDefinition } from '@/types';
import type { Message as OllamaMessage } from '@/utils/ollama';

import {
  getAssistantContentWidth,
  getCodeBlockHeight,
  getStreamingTextHeight,
} from './layout';
import { parseContent, unwrapRawMarkdownFence } from './parsing';
import { getMessageColor } from './styles';

interface Props {
  message: OllamaMessage;
  isStreaming?: boolean;
  theme: ThemeDefinition;
}

function renderStickyPaddingLines(count: number): React.ReactElement[] {
  return Array.from({ length: count }, (_, index) => (
    // v8 ignore start
    <Text key={index}> </Text>
    // v8 ignore stop
  ));
}

export function Message({ message, isStreaming = false, theme }: Props) {
  const messageColor = getMessageColor(message.role, theme);
  const isSystem = message.role === ROLE.SYSTEM;
  const isUser = message.role === ROLE.USER;
  const isStreamingAssistant = isStreaming && !isUser && !isSystem;

  const { stdout } = useStdout();
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

        const textParts = [
          { type: 'markdown', content: segment.content },
        ] as const;
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

        const textParts = [
          { type: 'markdown', content: segment.content },
        ] as const;

        // Text: User = plain text, Assistant = markdown
        return isUser ? (
          <Text key={index} color={messageColor}>
            {prefix + segment.content}
          </Text>
        ) : (
          <Box key={index} flexDirection="column" marginX={UI.AGENT_MARGIN_X}>
            {textParts.map((part, partIndex) => (
              <Markdown key={partIndex} content={part.content} theme={theme} />
            ))}
          </Box>
        );
      })}

      {renderStickyPaddingLines(stickyPaddingLines)}
    </Box>
  );
}
