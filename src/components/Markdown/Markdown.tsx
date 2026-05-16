import { Text, useStdout } from 'ink';
import { memo, useMemo } from 'react';

import { THEME } from '../../constants';
import { UI } from '../../constants';
import type { ThemeDefinition } from '../../types';
import { renderMarkdown } from './render';

interface MarkdownProps {
  content: string;
  color?: string;
  dimColor?: boolean;
  theme?: ThemeDefinition;
}

export const Markdown = memo(function Markdown({
  content,
  color,
  dimColor,
  theme = THEME.getTheme(),
}: MarkdownProps) {
  const { stdout } = useStdout();
  const availableWidth = stdout.columns - UI.AGENT_MARGIN_X * 2;

  const rendered = useMemo(
    () => renderMarkdown(content, availableWidth, theme.markdownTheme),
    [content, availableWidth, theme.markdownTheme],
  );

  return (
    <Text color={color} dimColor={dimColor}>
      {rendered}
    </Text>
  );
});
