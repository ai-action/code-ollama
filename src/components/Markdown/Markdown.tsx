import { Text } from 'ink';
import { marked } from 'marked';
import { markedTerminal } from 'marked-terminal';
import { memo } from 'react';

interface MarkdownProps {
  content: string;
  color?: string;
  dimColor?: boolean;
}

marked.use(
  markedTerminal({
    theme: 'gitHub',
  }),
);

function renderMarkdown(content: string): string {
  try {
    const result = marked.parse(content);
    // v8 ignore start
    return typeof result === 'string' ? result.trim() : content;
  } catch {
    return content;
  }
  // v8 ignore stop
}

export const Markdown = memo(function Markdown({
  content,
  color,
  dimColor,
}: MarkdownProps) {
  return (
    <Text color={color} dimColor={dimColor}>
      {renderMarkdown(content)}
    </Text>
  );
});
