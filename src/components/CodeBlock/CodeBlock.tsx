import { Box, Text } from 'ink';
import { memo, useEffect, useState } from 'react';

import { ROLE, THEME } from '@/constants';
import type { ThemeDefinition } from '@/types';

interface Props {
  code: string;
  language?: string;
  role: string;
  theme?: ThemeDefinition;
}

const highlightCache = new Map<string, string>();
const DIFF_LANGUAGE = 'diff';

function getDiffLineColor(
  line: string,
  isSystem: boolean,
  theme: ThemeDefinition,
) {
  switch (true) {
    case isSystem:
      return theme.colors.messageSystem;
    case line.startsWith('+') && !line.startsWith('+++'):
      return 'green';
    case line.startsWith('-') && !line.startsWith('---'):
      return 'red';
    case line.startsWith('@@'):
      return theme.colors.accent;
    case line.startsWith('---') || line.startsWith('+++'):
      return theme.colors.secondary;
  }
}

const CODE_BLOCK_REGEX =
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

export async function prewarmCodeBlocks(
  content: string,
  theme = THEME.getTheme(),
): Promise<void> {
  const promises: Promise<void>[] = [];
  let match;
  CODE_BLOCK_REGEX.lastIndex = 0;

  while ((match = CODE_BLOCK_REGEX.exec(content)) !== null) {
    const indent = match[1];
    const language = match[3];
    const code = normalizeCodeBlockContent(match[4], indent);
    // v8 ignore next 2
    if (code) {
      promises.push(prewarmHighlight(code, language, theme));
    }
  }

  await Promise.all(promises);
}

export async function prewarmHighlight(
  code: string,
  language?: string,
  theme = THEME.getTheme(),
): Promise<void> {
  // v8 ignore start
  const cacheKey = `${theme.codeTheme}:${language ?? ''}:${code}`;
  if (highlightCache.has(cacheKey)) {
    return;
  }
  // v8 ignore stop
  const result = await highlightCode(code, language, theme.codeTheme);
  highlightCache.set(cacheKey, result);
}

async function highlightCode(
  code: string,
  language = 'text',
  codeTheme = THEME.getTheme().codeTheme,
): Promise<string> {
  const { codeToANSI } = await import('@shikijs/cli');

  try {
    return await codeToANSI(code, language as never, codeTheme as never);
  } catch {
    // v8 ignore next
    return code;
  }
}

export const CodeBlock = memo(function CodeBlock({
  code,
  language,
  role,
  theme = THEME.getTheme(),
}: Props) {
  const isDiff = language === DIFF_LANGUAGE;
  const cacheKey = `${theme.codeTheme}:${language ?? ''}:${code}`;
  const [highlighted, setHighlighted] = useState<string>(
    () => highlightCache.get(cacheKey) ?? code,
  );

  useEffect(() => {
    let canceled = false;

    async function loadHighlight() {
      try {
        const result = await highlightCode(code, language, theme.codeTheme);
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
  }, [cacheKey, code, language, theme.codeTheme]);

  const isSystem = role === ROLE.SYSTEM;

  return (
    <Box
      flexDirection="column"
      borderStyle="bold"
      borderColor={isSystem ? theme.colors.secondary : theme.colors.codeBorder}
      paddingX={1}
      marginY={1}
    >
      {isDiff ? (
        code.split('\n').map((line, index) => {
          return (
            <Text
              key={index}
              color={getDiffLineColor(line, isSystem, theme)}
              dimColor={isSystem}
            >
              {
                // v8 ignore start
                line || ' '
                // v8 ignore stop
              }
            </Text>
          );
        })
      ) : (
        <Text
          color={isSystem ? theme.colors.messageSystem : undefined}
          dimColor={isSystem}
        >
          {highlighted}
        </Text>
      )}
    </Box>
  );
});
