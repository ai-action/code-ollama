import { useStdout } from 'ink';

import { ROLE, UI } from '@/constants';
import type { Role } from '@/types';
import { clipboard } from '@/utils';
import type { Message } from '@/utils/ollama';
import { renderWithTheme } from '@/utils/testing';

import { TURN_ABORTED_MESSAGE } from './constants';
import { Messages } from './Messages';

const { mockColumns } = vi.hoisted(() => ({
  mockColumns: {
    value: 100,
  },
}));

vi.mock('ink', async () => ({
  ...(await vi.importActual('ink')),
  useStdout: vi.fn(() => ({
    stdout: {
      columns: mockColumns.value,
    },
  })),
  useAnimation: () => ({ frame: 3 }),
}));

vi.mock('@inkjs/ui', () => ({
  useSpinner: () => ({ frame: '⏳' }),
}));

vi.mock('@shikijs/cli', () => ({
  codeToANSI: (code: string) => Promise.resolve(code),
}));

const userMessage: { role: Role; content: string } = {
  role: ROLE.USER,
  content: 'hello',
};

const userMessageWithImage: Message = {
  role: ROLE.USER,
  content: 'hello',
  images: ['/tmp/design.png'],
};

const assistantMessage: { role: Role; content: string } = {
  role: ROLE.ASSISTANT,
  content: 'world',
};

const emptyAssistantMessage: { role: Role; content: string } = {
  role: ROLE.ASSISTANT,
  content: '',
};

const systemMessage: { role: Role; content: string } = {
  role: ROLE.SYSTEM,
  content: 'system info',
};

function setTerminalWidth(columns: number) {
  mockColumns.value = columns;
}

function lineCount(frame: string | undefined) {
  return (frame ?? '').split('\n').length;
}

describe('Messages', () => {
  beforeEach(() => {
    setTerminalWidth(100);
    vi.mocked(useStdout).mockClear();
  });

  it('renders committed transcript items through static output', () => {
    const { lastFrame } = renderWithTheme(
      <Messages
        messages={[userMessage, assistantMessage]}
        isLoading={false}
        sessionId=""
      />,
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain(`${UI.PROMPT_PREFIX}hello`);
    expect(frame).toContain('world');
  });

  it('renders user message with prompt prefix', () => {
    const { lastFrame } = renderWithTheme(
      <Messages messages={[userMessage]} isLoading={false} sessionId="" />,
    );
    expect(lastFrame()).toContain(`${UI.PROMPT_PREFIX}hello`);
  });

  it('renders user attachment filenames inline', () => {
    const { lastFrame } = renderWithTheme(
      <Messages
        messages={[userMessageWithImage]}
        isLoading={false}
        sessionId=""
      />,
    );
    expect(lastFrame()).toContain('[design.png]');
    expect(lastFrame()).toContain('hello');
  });

  it('numbers clipboard images while preserving file attachment labels', () => {
    const { lastFrame } = renderWithTheme(
      <Messages
        messages={[
          {
            role: ROLE.USER,
            content: 'compare these',
            images: [
              `${clipboard.TEMP_IMAGES_DIRECTORY}/first-uuid.png`,
              '/tmp/design.png',
              `${clipboard.TEMP_IMAGES_DIRECTORY}/second-uuid.png`,
            ],
          },
        ]}
        isLoading={false}
        sessionId=""
      />,
    );

    expect(lastFrame()).toContain(
      '[Image 1] [design.png] [Image 2] compare these',
    );
  });

  it('renders user attachment without content and no extra space', () => {
    const messageWithImageOnly: Message = {
      role: ROLE.USER,
      content: '',
      images: ['/tmp/design.png'],
    };
    const { lastFrame } = renderWithTheme(
      <Messages
        messages={[messageWithImageOnly]}
        isLoading={false}
        sessionId=""
      />,
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('[design.png]');
    // Should not have trailing space after attachment when no content
    // The frame should contain "[design.png]" followed by newline, not "[design.png] "
    expect(frame).not.toContain('[design.png] ');
  });

  it('handles empty image path by showing original path', () => {
    const messageWithEmptyPath: Message = {
      role: ROLE.USER,
      content: 'test',
      images: [''],
    };
    const { lastFrame } = renderWithTheme(
      <Messages
        messages={[messageWithEmptyPath]}
        isLoading={false}
        sessionId=""
      />,
    );
    expect(lastFrame()).toContain('[]');
  });

  it('renders assistant message without prompt prefix', () => {
    const { lastFrame } = renderWithTheme(
      <Messages messages={[assistantMessage]} isLoading={false} sessionId="" />,
    );
    expect(lastFrame()).toContain('world');
    expect(lastFrame()).not.toContain(UI.PROMPT_PREFIX);
  });

  it('shows spinner when loading and last message content is empty', () => {
    const { lastFrame } = renderWithTheme(
      <Messages
        messages={[]}
        isLoading={true}
        sessionId=""
        streamingMessage={emptyAssistantMessage}
      />,
    );
    expect(lastFrame()).toContain('Thinking');
  });

  it('hides spinner when loading but last message has content', () => {
    const { lastFrame } = renderWithTheme(
      <Messages
        messages={[]}
        isLoading={true}
        sessionId=""
        streamingMessage={assistantMessage}
      />,
    );
    expect(lastFrame()).not.toContain('⏳');
  });

  it('hides spinner when not loading', () => {
    const { lastFrame } = renderWithTheme(
      <Messages
        messages={[emptyAssistantMessage]}
        isLoading={false}
        sessionId=""
      />,
    );
    expect(lastFrame()).not.toContain('⏳');
  });

  it('renders system message without prompt prefix', () => {
    const { lastFrame } = renderWithTheme(
      <Messages messages={[systemMessage]} isLoading={false} sessionId="" />,
    );
    expect(lastFrame()).toContain('system info');
    expect(lastFrame()).not.toContain(UI.PROMPT_PREFIX);
  });

  it('handles unknown role gracefully', () => {
    const unknownMessage = {
      role: 'unknown',
      content: 'test',
    } as unknown as Message;
    const { lastFrame } = renderWithTheme(
      <Messages messages={[unknownMessage]} isLoading={false} sessionId="" />,
    );
    expect(lastFrame()).toContain('test');
  });

  it('does not render turn_aborted messages', () => {
    const abortedMessage: { role: Role; content: string } = {
      role: ROLE.USER,
      content: TURN_ABORTED_MESSAGE,
    };
    const { lastFrame } = renderWithTheme(
      <Messages
        messages={[userMessage, abortedMessage]}
        isLoading={false}
        sessionId=""
      />,
    );
    expect(lastFrame()).toContain('hello');
    expect(lastFrame()).not.toContain('turn_aborted');
  });

  it('renders a streaming message after committed messages', () => {
    const { lastFrame } = renderWithTheme(
      <Messages
        messages={[userMessage]}
        isLoading={true}
        sessionId=""
        streamingMessage={assistantMessage}
      />,
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain(`${UI.PROMPT_PREFIX}hello`);
    expect(frame).toContain('world');
    expect(frame.indexOf('hello')).toBeLessThan(frame.indexOf('world'));
  });

  it('renders incomplete streaming inline code through markdown', () => {
    const streamingInlineCode: { role: Role; content: string } = {
      role: ROLE.ASSISTANT,
      content: 'Run `npm test',
    };
    const { lastFrame } = renderWithTheme(
      <Messages
        messages={[]}
        isLoading={true}
        sessionId=""
        streamingMessage={streamingInlineCode}
      />,
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('Run');
    expect(frame).toContain('`npm test');
  });

  it('renders incomplete streaming bold through markdown', () => {
    const streamingBold: { role: Role; content: string } = {
      role: ROLE.ASSISTANT,
      content: 'Use **important',
    };
    const { lastFrame } = renderWithTheme(
      <Messages
        messages={[]}
        isLoading={true}
        sessionId=""
        streamingMessage={streamingBold}
      />,
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('Use');
    expect(frame).toContain('**important');
  });

  it('keeps committed assistant markdown unchanged', () => {
    const committedBold: { role: Role; content: string } = {
      role: ROLE.ASSISTANT,
      content: 'Use **important**',
    };
    const { lastFrame } = renderWithTheme(
      <Messages messages={[committedBold]} isLoading={false} sessionId="" />,
    );
    expect(lastFrame()).toContain('Use important');
  });

  it('keeps live markdown formatting during streaming', () => {
    const streamingBold: { role: Role; content: string } = {
      role: ROLE.ASSISTANT,
      content: 'Use **important** text',
    };
    const { lastFrame } = renderWithTheme(
      <Messages
        messages={[]}
        isLoading={true}
        sessionId=""
        streamingMessage={streamingBold}
      />,
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('Use important text');
    expect(frame).not.toContain('**important**');
  });

  it('keeps later markdown lines renderable while freezing completed lines', () => {
    const streamingPlan: { role: Role; content: string } = {
      role: ROLE.ASSISTANT,
      content: ['## Plan', '', '1. **Inspect', '2. Continue'].join('\n'),
    };
    const { lastFrame } = renderWithTheme(
      <Messages
        messages={[]}
        isLoading={true}
        sessionId=""
        streamingMessage={streamingPlan}
      />,
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('Plan');
    expect(frame).toContain('Inspect');
    expect(frame).toContain('Continue');
  });

  it('keeps the streaming frame height stable when markdown reflows upward', () => {
    const incompleteBold: { role: Role; content: string } = {
      role: ROLE.ASSISTANT,
      content: 'Use **important',
    };
    const completeBold: { role: Role; content: string } = {
      role: ROLE.ASSISTANT,
      content: 'Use **important**',
    };
    const tree = (streamingMessage: { role: Role; content: string }) => (
      <Messages
        messages={[]}
        isLoading={true}
        sessionId=""
        streamingMessage={streamingMessage}
      />
    );

    const { lastFrame, rerender } = renderWithTheme(tree(incompleteBold));
    const initialHeight = lineCount(lastFrame());

    rerender(tree(completeBold));

    expect(lineCount(lastFrame())).toBe(initialHeight);
    expect(lastFrame()).toContain('Use important');
  });

  it('recomputes sticky streaming height when the terminal width changes', () => {
    const streamingBold: { role: Role; content: string } = {
      role: ROLE.ASSISTANT,
      content: 'Use **important** text',
    };
    const tree = () => (
      <Messages
        messages={[]}
        isLoading={true}
        sessionId=""
        streamingMessage={streamingBold}
      />
    );

    setTerminalWidth(100);
    const { lastFrame, rerender } = renderWithTheme(tree());

    setTerminalWidth(10);
    rerender(tree());

    expect(lastFrame()).toContain('Use');
    expect(lastFrame()).toContain('important');
  });

  it('renders sticky padding lines when streaming content shrinks', () => {
    // Incomplete bold takes more visual space than rendered bold
    const incompleteContent: { role: Role; content: string } = {
      role: ROLE.ASSISTANT,
      content: 'This is **unfinished bold text that spans multiple characters',
    };
    const completeContent: { role: Role; content: string } = {
      role: ROLE.ASSISTANT,
      content: 'This is **finished**',
    };
    const tree = (streamingMessage: { role: Role; content: string }) => (
      <Messages
        messages={[]}
        isLoading={true}
        sessionId=""
        streamingMessage={streamingMessage}
      />
    );

    const { lastFrame, rerender } = renderWithTheme(tree(incompleteContent));
    const initialFrame = lastFrame() ?? '';
    const initialHeight = lineCount(initialFrame);

    rerender(tree(completeContent));
    const finalFrame = lastFrame() ?? '';
    const finalHeight = lineCount(finalFrame);

    // Height should remain stable due to padding lines
    expect(finalHeight).toBe(initialHeight);
    expect(finalFrame).toContain('finished');
  });

  it('renders code blocks with syntax highlighting', () => {
    const messageWithCode: { role: Role; content: string } = {
      role: ROLE.ASSISTANT,
      content: 'Here is some code:\n\n```typescript\nconst x = 1;\n```',
    };
    const { lastFrame } = renderWithTheme(
      <Messages messages={[messageWithCode]} isLoading={false} sessionId="" />,
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('Here is some code:');
    expect(frame).toContain('const x = 1;');
  });

  it('renders code blocks without language', () => {
    const messageWithCode: { role: Role; content: string } = {
      role: ROLE.ASSISTANT,
      content: '```\nplain code\n```',
    };
    const { lastFrame } = renderWithTheme(
      <Messages messages={[messageWithCode]} isLoading={false} sessionId="" />,
    );
    expect(lastFrame()).toContain('plain code');
  });

  it('renders completed code blocks live while streaming', () => {
    const streamingCode: { role: Role; content: string } = {
      role: ROLE.ASSISTANT,
      content: '```typescript\nconst x = 1;\n```',
    };
    const { lastFrame } = renderWithTheme(
      <Messages
        messages={[]}
        isLoading={true}
        sessionId=""
        streamingMessage={streamingCode}
      />,
    );
    expect(lastFrame()).toContain('const x = 1;');
  });

  it('renders ambiguous raw fenced blocks while streaming', () => {
    const streamingRaw: { role: Role; content: string } = {
      role: ROLE.ASSISTANT,
      content: [
        'Example:',
        '```markdown',
        '## Title',
        '```ts',
        'const x = 1;',
        '```',
        '```',
        'Done.',
      ].join('\n'),
    };
    const { lastFrame } = renderWithTheme(
      <Messages
        messages={[]}
        isLoading={true}
        sessionId=""
        streamingMessage={streamingRaw}
      />,
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('Example:');
    expect(frame).toContain('## Title');
    expect(frame).toContain('```ts');
    expect(frame).toContain('Done.');
  });

  it('renders non-markdown raw fenced blocks while streaming', () => {
    const streamingRaw: { role: Role; content: string } = {
      role: ROLE.ASSISTANT,
      content: [
        'Shell example:',
        '```sh',
        'echo start',
        '```ts',
        'const x = 1;',
        '```',
        '```',
      ].join('\n'),
    };
    const { lastFrame } = renderWithTheme(
      <Messages
        messages={[]}
        isLoading={true}
        sessionId=""
        streamingMessage={streamingRaw}
      />,
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('Shell example:');
    expect(frame).toContain('```sh');
    expect(frame).toContain('```ts');
  });

  it('renders multiple code blocks in one message', () => {
    const messageWithMultipleCode: { role: Role; content: string } = {
      role: ROLE.ASSISTANT,
      content:
        'First:\n\n```js\nconst a = 1;\n```\n\nSecond:\n\n```python\nx = 2\n```',
    };
    const { lastFrame } = renderWithTheme(
      <Messages
        messages={[messageWithMultipleCode]}
        isLoading={false}
        sessionId=""
      />,
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('First:');
    expect(frame).toContain('Second:');
    expect(frame).toContain('const a = 1;');
    expect(frame).toContain('x = 2');
  });

  it('renders text before and after code blocks', () => {
    const messageWithSurroundingText: { role: Role; content: string } = {
      role: ROLE.ASSISTANT,
      content: 'Before code\n```ts\nconst x = 1;\n```\nAfter code',
    };
    const { lastFrame } = renderWithTheme(
      <Messages
        messages={[messageWithSurroundingText]}
        isLoading={false}
        sessionId=""
      />,
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('Before code');
    expect(frame).toContain('After code');
    expect(frame).toContain('const x = 1;');
  });

  it('renders indented fenced code blocks inside markdown text', () => {
    const messageWithIndentedFence: { role: Role; content: string } = {
      role: ROLE.ASSISTANT,
      content: [
        '**Improved Structure:**',
        '',
        '    ```markdown',
        '    ## Usage',
        '',
        '    ### Interactive TUI Mode',
        '    ```',
      ].join('\n'),
    };
    const { lastFrame } = renderWithTheme(
      <Messages
        messages={[messageWithIndentedFence]}
        isLoading={false}
        sessionId=""
      />,
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('Improved Structure:');
    expect(frame).toContain('## Usage');
    expect(frame).toContain('### Interactive TUI Mode');
    expect(frame).not.toContain('```markdown');
    expect(frame).not.toContain('\n    ## Usage');
  });

  it('falls back to raw text for ambiguous nested fences inside markdown examples', () => {
    const nestedFenceMessage: { role: Role; content: string } = {
      role: ROLE.ASSISTANT,
      content: [
        '**Current:**',
        '```markdown',
        '## Usage',
        '',
        '```sh',
        'code-ollama',
        '```',
        '```',
        '',
        'After example.',
      ].join('\n'),
    };

    const { lastFrame } = renderWithTheme(
      <Messages
        messages={[nestedFenceMessage]}
        isLoading={false}
        sessionId=""
      />,
    );
    const frame = lastFrame() ?? '';

    expect(frame).toContain('Current:');
    expect(frame).toContain('```sh');
    expect(frame).toContain('code-ollama');
    expect(frame).not.toContain('```markdown');
    expect(frame).toContain('After example.');
  });

  it('keeps non-markdown ambiguous raw fences literal inside a code block', () => {
    const nestedShellFenceMessage: { role: Role; content: string } = {
      role: ROLE.ASSISTANT,
      content: [
        'Shell example:',
        '```sh',
        'echo start',
        '```ts',
        'const x = 1;',
        '```',
        '```',
      ].join('\n'),
    };

    const { lastFrame } = renderWithTheme(
      <Messages
        messages={[nestedShellFenceMessage]}
        isLoading={false}
        sessionId=""
      />,
    );
    const frame = lastFrame() ?? '';

    expect(frame).toContain('Shell example:');
    expect(frame).toContain('```sh');
    expect(frame).toContain('```ts');
    expect(frame).toContain('const x = 1;');
  });

  it('does not swallow following markdown headings into the previous code block', () => {
    const messageWithFollowingHeading: { role: Role; content: string } = {
      role: ROLE.ASSISTANT,
      content: [
        'View the help documentation:',
        '',
        '```sh',
        'code-ollama --help',
        '```',
        '',
        '### ⭐ 3. Adding a "Prerequisites" Section',
        '',
        '**Goal:** Ensure users know what they need installed *before* they run the CLI.',
      ].join('\n'),
    };

    const { lastFrame } = renderWithTheme(
      <Messages
        messages={[messageWithFollowingHeading]}
        isLoading={false}
        sessionId=""
      />,
    );
    const frame = lastFrame() ?? '';
    const lines = frame.split('\n');
    const codeLineIndex = lines.findIndex((line) =>
      line.includes('code-ollama --help'),
    );
    const headingLineIndex = lines.findIndex((line) =>
      line.includes('3. Adding a "Prerequisites" Section'),
    );
    const borderAfterCode = lines.findIndex(
      (line, index) =>
        index > codeLineIndex &&
        (line.includes('┘') ||
          line.includes('┛') ||
          line.includes('└') ||
          line.includes('┗')),
    );

    expect(frame).toContain('View the help documentation:');
    expect(frame).toContain('code-ollama --help');
    expect(frame).toContain('3. Adding a "Prerequisites" Section');
    expect(frame).toContain('Ensure users know what they need installed');
    expect(codeLineIndex).toBeGreaterThan(-1);
    expect(headingLineIndex).toBeGreaterThan(-1);
    expect(borderAfterCode).toBeGreaterThan(-1);
    expect(borderAfterCode).toBeLessThan(headingLineIndex);
  });

  it('renders system message with toolResult diff', () => {
    const systemMessageWithDiff: Message = {
      role: ROLE.SYSTEM,
      content: 'File edited successfully: /test.ts',
      toolResult: {
        name: 'edit_file',
        diff: {
          path: '/test.ts',
          visible: '--- /test.ts\n+++ /test.ts\n-old\n+new',
          truncated: false,
          totalLines: 4,
          visibleLines: 4,
        },
      },
    };
    const { lastFrame } = renderWithTheme(
      <Messages
        messages={[systemMessageWithDiff]}
        isLoading={false}
        sessionId=""
      />,
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('File edited successfully');
    expect(frame).toContain('-old');
    expect(frame).toContain('+new');
  });

  it('renders successful tool results without their full output', () => {
    const { lastFrame } = renderWithTheme(
      <Messages
        messages={[
          {
            role: ROLE.SYSTEM,
            content: `Tool web_fetch result:\n${'page content '.repeat(100)}`,
            toolResult: { name: 'web_fetch' },
          },
        ]}
        isLoading={false}
        sessionId=""
      />,
    );
    const frame = lastFrame() ?? '';

    expect(frame).toContain('web_fetch completed');
    expect(frame).not.toContain('page content');
  });

  it('renders failed tool results compactly', () => {
    const { lastFrame } = renderWithTheme(
      <Messages
        messages={[
          {
            role: ROLE.SYSTEM,
            content: 'full failure output',
            toolResult: { name: 'web_fetch', error: 'HTTP 503\nstack' },
          },
        ]}
        isLoading={false}
        sessionId=""
      />,
    );
    const frame = lastFrame() ?? '';

    expect(frame).toContain('web_fetch failed: HTTP 503');
    expect(frame).not.toContain('full failure output');
    expect(frame).not.toContain('stack');
  });

  it('renders tool results without a name using fallback label', () => {
    const unnamedSuccess = {
      role: ROLE.SYSTEM,
      content: 'success output',
      toolResult: {},
    } as unknown as Message;
    const unnamedFailure = {
      role: ROLE.SYSTEM,
      content: 'failure output',
      toolResult: { error: 'HTTP 503\nstack' },
    } as unknown as Message;

    const { lastFrame } = renderWithTheme(
      <Messages
        messages={[unnamedSuccess, unnamedFailure]}
        isLoading={false}
        sessionId=""
      />,
    );
    const frame = lastFrame() ?? '';

    expect(frame).toContain(`${UI.DIAMOND} tool completed`);
    expect(frame).toContain(`${UI.DIAMOND} tool failed: HTTP 503`);
    expect(frame).not.toContain('success output');
    expect(frame).not.toContain('failure output');
    expect(frame).not.toContain('stack');
  });

  it('renders system code blocks as plain text (no syntax highlighting)', () => {
    const systemMessageWithCode: { role: Role; content: string } = {
      role: ROLE.SYSTEM,
      content: '```json\n{"status": "ok"}\n```',
    };
    const { lastFrame } = renderWithTheme(
      <Messages
        messages={[systemMessageWithCode]}
        isLoading={false}
        sessionId=""
      />,
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('{"status": "ok"}');
    expect(frame).not.toContain(UI.PROMPT_PREFIX);
  });

  it('preserves inline backticks in system messages', () => {
    const systemMessageWithInlineCode: { role: Role; content: string } = {
      role: ROLE.SYSTEM,
      content: 'Run `npx code-ollama` to start',
    };
    const { lastFrame } = renderWithTheme(
      <Messages
        messages={[systemMessageWithInlineCode]}
        isLoading={false}
        sessionId=""
      />,
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('`npx code-ollama`');
  });

  it('renders user code blocks as plain text (no syntax highlighting)', () => {
    const userMessageWithCode: { role: Role; content: string } = {
      role: ROLE.USER,
      content: 'Here is code:\n```ts\nconst x = 1;\n```',
    };
    const { lastFrame } = renderWithTheme(
      <Messages
        messages={[userMessageWithCode]}
        isLoading={false}
        sessionId=""
      />,
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('Here is code:');
    expect(frame).toContain('const x = 1;');
    expect(frame).toContain(UI.PROMPT_PREFIX);
  });

  it('handles ambiguous nested fences with language identifiers', () => {
    const ambiguousNestedMessage: { role: Role; content: string } = {
      role: ROLE.ASSISTANT,
      content: [
        'Example:',
        '```markdown',
        '## Title',
        '```js',
        'console.log("hello");',
        '```',
        '```js',
        'const x = 2;',
        '```',
        '```',
        'Done.',
      ].join('\n'),
    };

    const { lastFrame } = renderWithTheme(
      <Messages
        messages={[ambiguousNestedMessage]}
        isLoading={false}
        sessionId=""
      />,
    );
    const frame = lastFrame() ?? '';

    expect(frame).toContain('Example:');
    expect(frame).toContain('## Title');
    expect(frame).toContain('console.log("hello");');
    expect(frame).toContain('Done.');
  });

  it('treats unclosed fences as plain text', () => {
    const unclosedMessage: { role: Role; content: string } = {
      role: ROLE.ASSISTANT,
      content: [
        'Start',
        '```typescript',
        'const x = 1;',
        'console.log(x);',
      ].join('\n'),
    };

    const { lastFrame } = renderWithTheme(
      <Messages messages={[unclosedMessage]} isLoading={false} sessionId="" />,
    );
    const frame = lastFrame() ?? '';

    expect(frame).toContain('Start');
    expect(frame).toContain('const x = 1;');
    expect(frame).toContain('console.log(x);');
  });

  it('handles empty code blocks', () => {
    const emptyCodeMessage: { role: Role; content: string } = {
      role: ROLE.ASSISTANT,
      content: 'Example:\n```typescript\n   \n```\nDone.',
    };

    const { lastFrame } = renderWithTheme(
      <Messages messages={[emptyCodeMessage]} isLoading={false} sessionId="" />,
    );
    const frame = lastFrame() ?? '';

    expect(frame).toContain('Example:');
    expect(frame).toContain('Done.');
  });

  it('handles mismatched fence markers with same indent', () => {
    const mismatchedFenceMessage: { role: Role; content: string } = {
      role: ROLE.ASSISTANT,
      content: [
        'Example:',
        '```typescript',
        'const x = 1;',
        '~~~~',
        'four ticks',
        '~~~~',
        '```',
      ].join('\n'),
    };

    const { lastFrame } = renderWithTheme(
      <Messages
        messages={[mismatchedFenceMessage]}
        isLoading={false}
        sessionId=""
      />,
    );
    const frame = lastFrame() ?? '';

    expect(frame).toContain('Example:');
    expect(frame).toContain('const x = 1;');
    expect(frame).toContain('four ticks');
  });

  it('handles different indent with same fence chars', () => {
    const differentIndentMessage: { role: Role; content: string } = {
      role: ROLE.ASSISTANT,
      content: [
        'Example:',
        '```typescript',
        'const x = 1;',
        '  ```',
        'indented close',
        '```',
      ].join('\n'),
    };

    const { lastFrame } = renderWithTheme(
      <Messages
        messages={[differentIndentMessage]}
        isLoading={false}
        sessionId=""
      />,
    );
    const frame = lastFrame() ?? '';

    expect(frame).toContain('Example:');
    expect(frame).toContain('const x = 1;');
    expect(frame).toContain('indented close');
  });
});
