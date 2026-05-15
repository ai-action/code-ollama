import { Spinner } from '@inkjs/ui';
import { Box, Static, Text } from 'ink';
import { memo } from 'react';

import { ROLE, UI } from '../../constants';
import type { Message as OllamaMessage } from '../../utils/ollama';
import { CodeBlock, normalizeCodeBlockContent } from '../CodeBlock';
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
  type: 'text' | 'code' | 'raw';
  content: string;
  language?: string;
}

interface FenceState {
  fence: string;
  indent: string;
  language?: string;
  rawLines: string[];
  ambiguous: boolean;
  rawFenceDepth: number;
}

const FENCE_LINE_REGEX =
  /^(?<indent>[ \t]*)(?<fence>`{3,})(?<language>\w+)?[ \t]*$/;

function flushTextSegment(
  segments: ContentSegment[],
  textLines: string[],
): void {
  const textContent = textLines.join('\n').trim();
  if (textContent) {
    segments.push({ type: 'text', content: textContent });
  }
}

function flushCodeSegment(
  segments: ContentSegment[],
  codeLines: string[],
  fenceState: FenceState,
): void {
  if (fenceState.ambiguous) {
    segments.push({
      type: 'raw',
      content: fenceState.rawLines.join('\n'),
    });
    return;
  }

  const codeContent = normalizeCodeBlockContent(
    codeLines.join('\n'),
    fenceState.indent,
  );
  if (codeContent) {
    segments.push({
      type: 'code',
      content: codeContent,
      language: fenceState.language,
    });
  }
}

function unwrapRawMarkdownFence(content: string): string | null {
  if (!content.startsWith('```markdown\n') || !content.endsWith('\n```')) {
    return null;
  }

  return content.slice('```markdown\n'.length, -'\n```'.length);
}

function parseContent(content: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  const lines = content.split('\n');
  const textLines: string[] = [];
  const codeLines: string[] = [];
  let fenceState: FenceState | null = null;

  for (const line of lines) {
    const fenceMatch = FENCE_LINE_REGEX.exec(line);
    if (fenceMatch?.groups) {
      const { indent, fence, language } = fenceMatch.groups;

      if (!fenceState) {
        flushTextSegment(segments, textLines);
        textLines.length = 0;
        fenceState = {
          indent,
          fence,
          language,
          rawLines: [line],
          ambiguous: false,
          rawFenceDepth: 1,
        };
        continue;
      }

      if (indent === fenceState.indent && fence === fenceState.fence) {
        fenceState.rawLines.push(line);

        if (fenceState.ambiguous) {
          if (language) {
            fenceState.rawFenceDepth += 1;
            continue;
          }

          fenceState.rawFenceDepth -= 1;
          if (fenceState.rawFenceDepth === 0) {
            flushCodeSegment(segments, codeLines, fenceState);
            codeLines.length = 0;
            fenceState = null;
          }
          continue;
        }

        if (!language) {
          flushCodeSegment(segments, codeLines, fenceState);
          codeLines.length = 0;
          fenceState = null;
          continue;
        }

        fenceState.ambiguous = true;
        fenceState.rawFenceDepth += 1;
        continue;
      }
    }

    if (fenceState) {
      fenceState.rawLines.push(line);
      codeLines.push(line);
    } else {
      textLines.push(line);
    }
  }

  if (fenceState) {
    textLines.push(...fenceState.rawLines);
  }

  flushTextSegment(segments, textLines);

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
