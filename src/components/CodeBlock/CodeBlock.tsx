import { Box, Text } from 'ink';
import { memo, useEffect, useState } from 'react';

import { ROLE } from '../../constants';

interface CodeBlockProps {
  code: string;
  language?: string;
  role: string;
}

const highlightCache = new Map<string, string>();

export const CODE_BLOCK_REGEX =
  /^(?<indent>[ \t]*)(`{3,})(\w+)?[ \t]*\n([\s\S]*?)^\k<indent>\2[ \t]*$/gm;

export function normalizeCodeBlockContent(
  content: string,
  indent = '',
): string {
  if (!indent) {
    return content.trim();
  }

  const indentPattern = new RegExp(`^${indent}`, 'gm');
  return content.replace(indentPattern, '').trim();
}

export async function prewarmCodeBlocks(content: string): Promise<void> {
  const promises: Promise<void>[] = [];
  let match;
  CODE_BLOCK_REGEX.lastIndex = 0;

  while ((match = CODE_BLOCK_REGEX.exec(content)) !== null) {
    const indent = match[1];
    const language = match[3];
    const code = normalizeCodeBlockContent(match[4], indent);
    // v8 ignore next 2
    if (code) {
      promises.push(prewarmHighlight(code, language));
    }
  }

  await Promise.all(promises);
}

export async function prewarmHighlight(
  code: string,
  language?: string,
): Promise<void> {
  // v8 ignore start
  const cacheKey = `${language ?? ''}:${code}`;
  if (highlightCache.has(cacheKey)) {
    return;
  }
  // v8 ignore stop
  const result = await highlightCode(code, language);
  highlightCache.set(cacheKey, result);
}

async function highlightCode(code: string, language = 'text'): Promise<string> {
  const { codeToANSI } = await import('@shikijs/cli');

  try {
    return await codeToANSI(code, language as never, 'github-light');
  } catch {
    // v8 ignore next
    return code;
  }
}

export const CodeBlock = memo(function CodeBlock({
  code,
  language,
  role,
}: CodeBlockProps) {
  const cacheKey = `${language ?? ''}:${code}`;
  const [highlighted, setHighlighted] = useState<string>(
    () => highlightCache.get(cacheKey) ?? code,
  );

  useEffect(() => {
    let canceled = false;

    async function loadHighlight() {
      try {
        const result = await highlightCode(code, language);
        highlightCache.set(cacheKey, result);
        if (!canceled) {
          setHighlighted(result);
        }
      } catch {
        // Keep plain code on error
      }
    }

    void loadHighlight();

    return () => {
      canceled = true;
    };
  }, [cacheKey, code, language]);

  const isSystem = role === ROLE.SYSTEM;

  return (
    <Box
      flexDirection="column"
      borderStyle="bold"
      borderColor={isSystem ? 'gray' : 'dim'}
      paddingX={1}
      marginY={1}
    >
      <Text dimColor={isSystem}>{highlighted}</Text>
    </Box>
  );
});
