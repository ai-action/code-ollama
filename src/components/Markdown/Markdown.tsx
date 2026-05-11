import { Text, useStdout } from 'ink';
import { marked, Tokens } from 'marked';
import { markedTerminal } from 'marked-terminal';
import { memo, useMemo } from 'react';

import { UI } from '../../constants';

interface MarkdownProps {
  content: string;
  color?: string;
  dimColor?: boolean;
}

const HR_PLACEHOLDER = '__CODE_OLLAMA_HR_PLACEHOLDER__';

const LATEX_COMMANDS: Record<string, string> = {
  '\\rightarrow': '→',
  '\\leftarrow': '←',
  '\\Rightarrow': '⇒',
  '\\Leftarrow': '⇐',
  '\\leftrightarrow': '↔',
  '\\Leftrightarrow': '⟺',
  '\\uparrow': '↑',
  '\\downarrow': '↓',
  '\\to': '→',
  '\\gets': '←',
  '\\times': '×',
  '\\div': '÷',
  '\\pm': '±',
  '\\leq': '≤',
  '\\geq': '≥',
  '\\neq': '≠',
  '\\approx': '≈',
  '\\equiv': '≡',
  '\\infty': '∞',
  '\\sum': '∑',
  '\\prod': '∏',
  '\\sqrt': '√',
  '\\partial': '∂',
  '\\nabla': '∇',
  '\\in': '∈',
  '\\notin': '∉',
  '\\subset': '⊂',
  '\\supset': '⊃',
  '\\cup': '∪',
  '\\cap': '∩',
  '\\emptyset': '∅',
  '\\alpha': 'α',
  '\\beta': 'β',
  '\\gamma': 'γ',
  '\\delta': 'δ',
  '\\epsilon': 'ε',
  '\\theta': 'θ',
  '\\lambda': 'λ',
  '\\mu': 'μ',
  '\\pi': 'π',
  '\\sigma': 'σ',
  '\\tau': 'τ',
  '\\phi': 'φ',
  '\\omega': 'ω',
  '\\$': '$',
  '\\%': '%',
  '\\&': '&',
  '\\#': '#',
  '\\{': '{',
  '\\}': '}',
  '\\^': '^',
  '\\_': '_',
  '\\cdot': '·',
  '\\ldots': '…',
  '\\cdots': '⋯',
};

function convertLatex(math: string): string {
  let result = math.trim();
  for (const [cmd, unicode] of Object.entries(LATEX_COMMANDS)) {
    result = result.replaceAll(cmd, unicode);
  }
  result = result.replace(/\\[a-zA-Z]+\{([^}]*)\}/g, '$1');
  result = result.replace(/\\[a-zA-Z]+/g, '');
  return result.trim();
}

marked.use(
  markedTerminal({
    theme: 'gitHub',
  }),
);

marked.use({
  extensions: [
    {
      name: 'inlineMath',
      level: 'inline',
      start: (src: string) => src.indexOf('$'),
      tokenizer(src: string) {
        const match = /^\$([^$\n]+?)\$/.exec(src);
        if (match) {
          return {
            type: 'inlineMath',
            raw: match[0],
            math: match[1],
          };
        }
        return undefined;
      },
      renderer(token: Tokens.Generic) {
        // v8 ignore next
        return convertLatex((token.math as string | undefined) ?? '');
      },
    },
  ],
  renderer: {
    hr: () => `${HR_PLACEHOLDER}\n`,
  },
});

function renderMarkdown(content: string, hrWidth: number): string {
  const hr = UI.MARKDOWN_HR_CHARACTER.repeat(Math.max(1, hrWidth));

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
