import { Marked, type Token } from 'marked';
import type { TerminalRendererOptions } from 'marked-terminal';
import { markedTerminal } from 'marked-terminal';

import { UI } from '../../constants';
import { inlineMathExtension } from './extensions';

const HR_PLACEHOLDER = '__CODE_OLLAMA_HR_PLACEHOLDER__';

export function renderMarkdown(
  content: string,
  hrWidth: number,
  syntaxTheme: TerminalRendererOptions['theme'] = 'gitHub',
): string {
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
      theme: syntaxTheme,
      reflowText: true,
      width: Math.max(1, hrWidth),
    }),
  );

  markdown.use(rendererExtension);

  try {
    const result = markdown.parse(content);
    // v8 ignore next
    const text = typeof result === 'string' ? result.trim() : content;
    return text.replaceAll(HR_PLACEHOLDER, hr);
  } catch {
    // v8 ignore next
    return content;
  }
}
