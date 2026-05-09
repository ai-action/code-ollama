import { Box, Text } from 'ink';
import { memo, useEffect, useState } from 'react';

import { ROLE } from '../../constants';

interface CodeBlockProps {
  code: string;
  language?: string;
  role: string;
}

function getLanguageColor(language: string): string {
  switch (language.toLowerCase()) {
    case 'typescript':
    case 'ts':
      return 'blue';
    case 'javascript':
    case 'js':
      return 'yellow';
    case 'python':
    case 'py':
      return 'green';
    case 'json':
      return 'cyan';
    case 'bash':
    case 'sh':
    case 'shell':
      return 'red';
    case 'html':
      return 'magenta';
    case 'css':
      return 'blue';
    case 'markdown':
    case 'md':
      return 'white';
    default:
      return 'gray';
  }
}

async function highlightCode(code: string, language = 'text'): Promise<string> {
  // Dynamic import to avoid loading shiki unless needed
  const { codeToANSI } = await import('@shikijs/cli');
  try {
    return await codeToANSI(code, language as never, 'github-light');
  } catch {
    // v8 ignore next - Defensive fallback for unsupported languages
    return code;
  }
}

export const CodeBlock = memo(function CodeBlock({
  code,
  language,
  role,
}: CodeBlockProps) {
  const [highlighted, setHighlighted] = useState<string>(code);

  useEffect(() => {
    let cancelled = false;

    async function loadHighlight() {
      try {
        const result = await highlightCode(code, language);
        if (!cancelled) {
          setHighlighted(result);
        }
      } catch {
        // Keep plain code on error
      }
    }

    void loadHighlight();

    return () => {
      cancelled = true;
    };
  }, [code, language]);

  const isSystem = role === ROLE.SYSTEM;
  const langLabel = language?.toUpperCase() ?? 'CODE';

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={isSystem ? 'gray' : 'dim'}
      paddingX={1}
      marginY={1}
    >
      {language && (
        <Box marginBottom={1}>
          <Text bold color={getLanguageColor(language)}>
            {langLabel}
          </Text>
        </Box>
      )}
      <Box>
        <Text dimColor={isSystem}>{highlighted}</Text>
      </Box>
    </Box>
  );
});
