import { Text, useStdout } from 'ink';
import { memo, useMemo } from 'react';

import { UI } from '../../constants';
import { renderMarkdown } from './render';

interface MarkdownProps {
  content: string;
  color?: string;
  dimColor?: boolean;
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
