import { Text, useStdout } from 'ink';
import { Marked, type Token } from 'marked';
import { markedTerminal } from 'marked-terminal';
import { memo, useMemo } from 'react';

import { UI } from '../../constants';
import { inlineMathExtension } from './extensions';

interface MarkdownProps {
  content: string;
  color?: string;
  dimColor?: boolean;
}

const HR_PLACEHOLDER = '__CODE_OLLAMA_HR_PLACEHOLDER__';

function renderMarkdown(content: string, hrWidth: number): string {
  const hr = UI.MARKDOWN_HR_CHARACTER.repeat(Math.max(1, hrWidth));
  const markdown = new Marked();
  const rendererExtension = {
    extensions: [inlineMathExtension],
    useNewRenderer: true,
    renderer: {
      hr: () => `${HR_PLACEHOLDER}\n`,
      text(token: Token) {
        const textToken = token as Token & {
          text?: string;
          tokens?: Token[];
        };

        if (typeof token === 'object' && Array.isArray(textToken.tokens)) {
          return this.parser.parseInline(textToken.tokens);
        }

        return String(textToken.text);
      },
    },
  } as Parameters<Marked['use']>[0];

  markdown.use(
    markedTerminal({
      theme: 'gitHub',
      reflowText: true,
      width: Math.max(1, hrWidth),
    }),
  );

  markdown.use(rendererExtension);

  try {
    const result = markdown.parse(content);
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
