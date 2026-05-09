import { Text, useStdout } from 'ink';
import { marked } from 'marked';
import { markedTerminal } from 'marked-terminal';
import { memo, useMemo } from 'react';

import { UI } from '../../constants';

interface MarkdownProps {
  content: string;
  color?: string;
  dimColor?: boolean;
}

const HR_PLACEHOLDER = '__HR_PLACEHOLDER__';

marked.use(
  markedTerminal({
    theme: 'gitHub',
  }),
);

marked.use({
  renderer: {
    hr: () => `${HR_PLACEHOLDER}\n`,
  },
});

function renderMarkdown(content: string, hrWidth: number): string {
  const hr = '-'.repeat(Math.max(1, hrWidth));

  try {
    const result = marked.parse(content);
    // v8 ignore start
    const text = typeof result === 'string' ? result.trim() : content;
    return text.replaceAll(HR_PLACEHOLDER, hr);
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
  const { stdout } = useStdout();
  const availableWidth = stdout.columns - UI.AGENT_MARGIN_X * 2;

  const rendered = useMemo(
    () => renderMarkdown(content, availableWidth),
    [content, availableWidth],
  );

  return (
    <Text color={color} dimColor={dimColor}>
      {rendered}
    </Text>
  );
});
