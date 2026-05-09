import { Text } from 'ink';
import { marked } from 'marked';
import TerminalRenderer from 'marked-terminal';
import { memo, useEffect, useState } from 'react';

interface MarkdownProps {
  content: string;
  color?: string;
  dimColor?: boolean;
}

// Configure marked with terminal renderer
// Using gitHub theme for light terminal visibility
marked.setOptions({
  renderer: new TerminalRenderer({
    theme: 'gitHub',
  }),
});

function renderMarkdown(content: string): string {
  const result = marked.parse(content);
  // v8 ignore next - Defensive fallback for Promise return
  return typeof result === 'string' ? result : '';
}

export const Markdown = memo(function Markdown({
  content,
  color,
  dimColor,
}: MarkdownProps) {
  const [rendered, setRendered] = useState<string>(content);

  useEffect(() => {
    let canceled = false;

    function loadMarkdown() {
      try {
        const result = renderMarkdown(content);

        // v8 ignore start
        if (!canceled) {
          setRendered(result);
        }
      } catch {
        // Keep plain content on error
      }
      // v8 ignore stop
    }

    loadMarkdown();

    return () => {
      canceled = true;
    };
  }, [content]);

  return (
    <Text color={color} dimColor={dimColor}>
      {rendered}
    </Text>
  );
});
