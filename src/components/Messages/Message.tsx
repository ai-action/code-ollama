import { Box, Text, useStdout } from 'ink';
import { useRef } from 'react';

import { CodeBlock } from '@/components/CodeBlock';
import { Markdown } from '@/components/Markdown';
import { ROLE, UI } from '@/constants';
import { useTheme } from '@/contexts';
import type { Message as OllamaMessage } from '@/utils/ollama';

import { getAttachmentLabels } from '../Chat/attachments';
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
  marginBottom?: number;
}

function renderStickyPaddingLines(count: number): React.ReactElement[] {
  return Array.from({ length: count }, (_, index) => (
    // v8 ignore start
    <Text key={index}> </Text>
    // v8 ignore stop
  ));
}

function ToolResultMessage({
  marginBottom,
  message,
  messageColor,
}: {
  marginBottom: number;
  message: OllamaMessage;
  messageColor?: string;
}) {
  const diffContent = message.toolResult?.diff?.visible;
  const error = message.toolResult?.error?.split('\n', 1)[0];
  const displayContent = diffContent
    ? message.content
    : error
      ? `${UI.DIAMOND} ${message.toolResult?.name ?? 'tool'} failed: ${error}`
      : `${UI.DIAMOND} ${message.toolResult?.name ?? 'tool'} completed`;

  return (
    <Box
      flexDirection="column"
      marginBottom={marginBottom}
      marginX={UI.SCREEN_MARGIN_X}
    >
      <Text color={messageColor} dimColor>
        {displayContent}
      </Text>

      {diffContent && (
        <CodeBlock code={diffContent} language="diff" role={ROLE.ASSISTANT} />
      )}
    </Box>
  );
}

export function Message({
  message,
  isStreaming = false,
  marginBottom = 1,
}: Props) {
  const theme = useTheme();
  const messageColor = getMessageColor(message.role, theme, message.content);
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
    if (message.toolResult) {
      return (
        <ToolResultMessage
          marginBottom={marginBottom}
          message={message}
          messageColor={
            message.toolResult.error ? theme.colors.error : messageColor
          }
        />
      );
    }

    return (
      <Box
        flexDirection="column"
        marginBottom={marginBottom}
        marginX={UI.SCREEN_MARGIN_X}
      >
        <Text color={messageColor} dimColor>
          {message.content}
        </Text>
      </Box>
    );
  }

  if (isUser) {
    const attachments = message.images ?? [];
    const attachmentPrefix = getAttachmentLabels(attachments)
      .map((label) => `[${label}]`)
      .join(' ');

    return (
      <Box flexDirection="column" marginBottom={marginBottom}>
        <Text color={messageColor}>
          {UI.PROMPT_PREFIX}
          {attachmentPrefix ? (
            <>
              <Text color={theme.colors.accent}>{attachmentPrefix}</Text>
              {message.content ? ' ' : ''}
            </>
          ) : null}
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
    <Box flexDirection="column" marginBottom={marginBottom}>
      {segments.map((segment, index) => {
        if (segment.type === 'code') {
          return (
            <Box key={index} marginX={UI.SCREEN_MARGIN_X}>
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
            <Box key={index} marginX={UI.SCREEN_MARGIN_X}>
              <CodeBlock
                code={markdownSource ?? segment.content}
                language={markdownSource ? 'markdown' : segment.language}
                role={message.role}
              />
            </Box>
          );
        }

        const textParts = [
          { type: 'markdown', content: segment.content },
        ] as const;

        return (
          <Box key={index} flexDirection="column" marginX={UI.SCREEN_MARGIN_X}>
            {textParts.map((part, partIndex) => (
              <Markdown
                key={partIndex}
                content={part.content}
                color={messageColor}
              />
            ))}
          </Box>
        );
      })}

      {renderStickyPaddingLines(stickyPaddingLines)}
    </Box>
  );
}
