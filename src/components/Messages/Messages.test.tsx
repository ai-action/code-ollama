import { Text } from 'ink';
import { render } from 'ink-testing-library';

import { ROLE, UI } from '../../constants';
import type { Role } from '../../types';
import { TURN_ABORTED_MESSAGE } from './constants';
import { Messages } from './Messages';

vi.mock('@inkjs/ui', () => ({
  Spinner: ({ label }: { label?: string }) => <Text>{`⏳${label ?? ''}`}</Text>,
}));

vi.mock('@shikijs/cli', () => ({
  codeToANSI: (code: string) => Promise.resolve(code),
}));

const userMessage: { role: Role; content: string } = {
  role: ROLE.USER,
  content: 'hello',
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

describe('Messages', () => {
  it('renders committed transcript items through static output', () => {
    const { lastFrame } = render(
      <Messages messages={[userMessage, assistantMessage]} isLoading={false} />,
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain(`${UI.PROMPT_PREFIX}hello`);
    expect(frame).toContain('world');
  });

  it('renders user message with prompt prefix', () => {
    const { lastFrame } = render(
      <Messages messages={[userMessage]} isLoading={false} />,
    );
    expect(lastFrame()).toContain(`${UI.PROMPT_PREFIX}hello`);
  });

  it('renders assistant message without prompt prefix', () => {
    const { lastFrame } = render(
      <Messages messages={[assistantMessage]} isLoading={false} />,
    );
    expect(lastFrame()).toContain('world');
    expect(lastFrame()).not.toContain(UI.PROMPT_PREFIX);
  });

  it('shows spinner when loading and last message content is empty', () => {
    const { lastFrame } = render(
      <Messages
        messages={[]}
        isLoading={true}
        streamingMessage={emptyAssistantMessage}
      />,
    );
    expect(lastFrame()).toContain('⏳Thinking...');
  });

  it('hides spinner when loading but last message has content', () => {
    const { lastFrame } = render(
      <Messages
        messages={[]}
        isLoading={true}
        streamingMessage={assistantMessage}
      />,
    );
    expect(lastFrame()).not.toContain('⏳');
  });

  it('hides spinner when not loading', () => {
    const { lastFrame } = render(
      <Messages messages={[emptyAssistantMessage]} isLoading={false} />,
    );
    expect(lastFrame()).not.toContain('⏳');
  });

  it('renders system message without prompt prefix', () => {
    const { lastFrame } = render(
      <Messages messages={[systemMessage]} isLoading={false} />,
    );
    expect(lastFrame()).toContain('system info');
    expect(lastFrame()).not.toContain(UI.PROMPT_PREFIX);
  });

  it('handles unknown role gracefully', () => {
    const unknownMessage = {
      role: 'unknown',
      content: 'test',
    } as unknown as import('../../utils/ollama').Message;
    const { lastFrame } = render(
      <Messages messages={[unknownMessage]} isLoading={false} />,
    );
    expect(lastFrame()).toContain('test');
  });

  it('does not render turn_aborted messages', () => {
    const abortedMessage: { role: Role; content: string } = {
      role: ROLE.USER,
      content: TURN_ABORTED_MESSAGE,
    };
    const { lastFrame } = render(
      <Messages messages={[userMessage, abortedMessage]} isLoading={false} />,
    );
    expect(lastFrame()).toContain('hello');
    expect(lastFrame()).not.toContain('turn_aborted');
  });

  it('renders a streaming message after committed messages', () => {
    const { lastFrame } = render(
      <Messages
        messages={[userMessage]}
        isLoading={true}
        streamingMessage={assistantMessage}
      />,
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain(`${UI.PROMPT_PREFIX}hello`);
    expect(frame).toContain('world');
    expect(frame.indexOf('hello')).toBeLessThan(frame.indexOf('world'));
  });

  it('renders incomplete streaming inline code as plain text without opener', () => {
    const streamingInlineCode: { role: Role; content: string } = {
      role: ROLE.ASSISTANT,
      content: 'Run `npm test',
    };
    const { lastFrame } = render(
      <Messages
        messages={[]}
        isLoading={true}
        streamingMessage={streamingInlineCode}
      />,
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('Run');
    expect(frame).toContain('npm test');
    expect(frame).not.toContain('`npm test');
  });

  it('renders incomplete streaming bold as plain text without opener', () => {
    const streamingBold: { role: Role; content: string } = {
      role: ROLE.ASSISTANT,
      content: 'Use **important',
    };
    const { lastFrame } = render(
      <Messages
        messages={[]}
        isLoading={true}
        streamingMessage={streamingBold}
      />,
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('Use');
    expect(frame).toContain('important');
    expect(frame).not.toContain('**important');
  });

  it('keeps committed assistant markdown unchanged', () => {
    const committedBold: { role: Role; content: string } = {
      role: ROLE.ASSISTANT,
      content: 'Use **important**',
    };
    const { lastFrame } = render(
      <Messages messages={[committedBold]} isLoading={false} />,
    );
    expect(lastFrame()).toContain('Use important');
  });

  it('renders code blocks with syntax highlighting', () => {
    const messageWithCode: { role: Role; content: string } = {
      role: ROLE.ASSISTANT,
      content: 'Here is some code:\n\n```typescript\nconst x = 1;\n```',
    };
    const { lastFrame } = render(
      <Messages messages={[messageWithCode]} isLoading={false} />,
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
    const { lastFrame } = render(
      <Messages messages={[messageWithCode]} isLoading={false} />,
    );
    expect(lastFrame()).toContain('plain code');
  });

  it('renders multiple code blocks in one message', () => {
    const messageWithMultipleCode: { role: Role; content: string } = {
      role: ROLE.ASSISTANT,
      content:
        'First:\n\n```js\nconst a = 1;\n```\n\nSecond:\n\n```python\nx = 2\n```',
    };
    const { lastFrame } = render(
      <Messages messages={[messageWithMultipleCode]} isLoading={false} />,
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
    const { lastFrame } = render(
      <Messages messages={[messageWithSurroundingText]} isLoading={false} />,
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
    const { lastFrame } = render(
      <Messages messages={[messageWithIndentedFence]} isLoading={false} />,
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('Improved Structure:');
    expect(frame).toContain('## Usage');
    expect(frame).toContain('### Interactive TUI Mode');
    expect(frame).not.toContain('```markdown');
    expect(frame).not.toContain('\n    ## Usage');
  });

  it('renders the markdown sample assistant message without leaking fenced block delimiters', () => {
    const markdownSamplesMessage: { role: Role; content: string } = {
      role: ROLE.ASSISTANT,
      content:
        "Based on the search results, Markdown is a lightweight markup language used to format plain text. It's designed to be easy to read and write, and it gets converted into HTML for display.\n\n" +
        "Here are some common markdown samples covering the basic syntax. I'll show you the **Markdown Input** and what the **Rendered Output** should look like.\n\n" +
        '### ✏️ Basic Structure & Formatting\n\n' +
        '| Feature | Markdown Input | Rendered Output |\n' +
        '| :--- | :--- | :--- |\n' +
        '| **Heading 1** | `# Main Title` | **<h1>Main Title</h1>** |\n' +
        '| **Heading 2** | `## Section Header` | **<h2>Section Header</h2>** |\n' +
        '| **Heading 3** | `### Subsection` | **<h3>Subsection</h3>** |\n' +
        '| **Bold Text** | `**This text is bold**` or `__This text is bold__` | **This text is bold** |\n' +
        '| **Italics Text** | `*This text is italic*` or `_This text is italic_` | *This text is italic* |\n' +
        '| **Strikethrough** | `~~This text is crossed out~~` | ~~This text is crossed out~~ |\n' +
        '| **Blockquote** | `> This is a quote.` | *This is a quote.* |\n\n' +
        '### 📝 Lists\n\n' +
        'Markdown supports ordered (numbered) and unordered (bulleted) lists.\n\n' +
        '**Unordered List (Bullets)**\n' +
        '```markdown\n' +
        '* Item one\n' +
        '* Item two\n' +
        '    * Sub-item A\n' +
        '    * Sub-item B\n' +
        '* Item three\n' +
        '```\n' +
        '*Rendered Output:*\n' +
        '* Item one\n' +
        '* Item two\n' +
        '    * Sub-item A\n' +
        '    * Sub-item B\n' +
        '* Item three\n\n' +
        '**Ordered List (Numbered)**\n' +
        '```markdown\n' +
        '1. First step\n' +
        '2. Second step\n' +
        '3. Third step\n' +
        '```\n' +
        '*Rendered Output:*\n' +
        '1. First step\n' +
        '2. Second step\n' +
        '3. Third step\n\n' +
        '### 🔗 Links and Images\n\n' +
        '| Element | Markdown Input | Rendered Output |\n' +
        '| :--- | :--- | :--- |\n' +
        '| **Link** | `[Google Links](https://www.google.com)` | [Google Links](https://www.google.com) |\n' +
        '| **Image** | `![Alt text](image-url.jpg)` | *(Displays an image)* |\n\n' +
        '### 💻 Code Blocks\n\n' +
        'Code blocks are essential for showing snippets of code. There are two main types:\n\n' +
        '1.  **Inline Code** (for short snippets within a sentence): Use single backticks (\\`).\n' +
        "    *Input:* `The function is called \\`calculateSum()\\`.'`\n" +
        '    *Output:* The function is called `calculateSum()`.\n\n' +
        '2.  **Code Block** (for multi-line code): Use triple backticks (```) and optionally specify the language for syntax highlighting.\n' +
        '    *Input:*\n' +
        '    ```typescript\n' +
        '    function greet(name: string): void {\n' +
        '        console.log(`Hello, ${name}!`);\n' +
        '    }\n' +
        '    ```\n' +
        '    *Output:* (Formatted as a code block, typically with syntax highlighting)\n\n' +
        '### 📊 Tables\n\n' +
        'Tables are structured using pipes (`|`) and hyphens (`-`).\n\n' +
        '```markdown\n' +
        '| Header 1 | Header 2 | Header 3 |\n' +
        '| :--- | :---: | ---: |\n' +
        '| Left Aligned | Center Aligned | Right Aligned |\n' +
        '| Data A | Data B | Data C |\n' +
        '```\n' +
        '*Rendered Output:* (A clean table structure)\n\n' +
        '***\n\n' +
        'Do you need samples for a more specific feature, such as **Tables**, **Footnotes**, or perhaps how to integrate this with **TypeScript/Code Snippets**?',
    };

    const { lastFrame } = render(
      <Messages messages={[markdownSamplesMessage]} isLoading={false} />,
    );
    const frame = lastFrame() ?? '';

    expect(frame).toContain('Basic Structure & Formatting');
    expect(frame).toContain('Unordered List (Bullets)');
    expect(frame).toContain('function greet(name: string): void {');
    expect(frame).toContain('console.log(`Hello, ${name}!`);');
    expect(frame).toContain('Do you need samples for a more specific feature');
    expect(frame).not.toContain('```markdown');
    expect(frame).not.toContain('```typescript');
  });

  it('renders system code blocks as plain text (no syntax highlighting)', () => {
    const systemMessageWithCode: { role: Role; content: string } = {
      role: ROLE.SYSTEM,
      content: '```json\n{"status": "ok"}\n```',
    };
    const { lastFrame } = render(
      <Messages messages={[systemMessageWithCode]} isLoading={false} />,
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
    const { lastFrame } = render(
      <Messages messages={[systemMessageWithInlineCode]} isLoading={false} />,
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('`npx code-ollama`');
  });

  it('renders user code blocks as plain text (no syntax highlighting)', () => {
    const userMessageWithCode: { role: Role; content: string } = {
      role: ROLE.USER,
      content: 'Here is code:\n```ts\nconst x = 1;\n```',
    };
    const { lastFrame } = render(
      <Messages messages={[userMessageWithCode]} isLoading={false} />,
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('Here is code:');
    expect(frame).toContain('const x = 1;');
    expect(frame).toContain(UI.PROMPT_PREFIX);
  });
});
