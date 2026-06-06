import { Text, useStdout } from 'ink';
import { memo, useMemo } from 'react';

import { UI } from '@/constants';
import { useTheme } from '@/contexts';

import { renderMarkdown } from './render';

interface Props {
  content: string;
  color?: string;
  dimColor?: boolean;
}

export const Markdown = memo(function Markdown({
  content,
  color,
  dimColor,
}: Props) {
  const theme = useTheme();
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
