import type { Tokens } from 'marked';

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

export const inlineMathExtension = {
  name: 'inlineMath',
  level: 'inline' as const,
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
};
