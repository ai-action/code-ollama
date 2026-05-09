import { Text } from 'ink';
import { render } from 'ink-testing-library';

import { ROLE, UI } from '../../constants';
import { TURN_ABORTED_MESSAGE } from './constants';
import { Messages } from './Messages';

vi.mock('@inkjs/ui', () => ({
  Spinner: ({ label }: { label?: string }) => <Text>{`⏳${label ?? ''}`}</Text>,
}));

vi.mock('@shikijs/cli', () => ({
  codeToANSI: (code: string) => Promise.resolve(code),
}));

const userMessage = { role: ROLE.USER, content: 'hello' };
const assistantMessage = { role: ROLE.ASSISTANT, content: 'world' };
const emptyAssistantMessage = { role: ROLE.ASSISTANT, content: '' };
const systemMessage = { role: ROLE.SYSTEM, content: 'system info' };

describe('Messages', () => {
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
    const abortedMessage = { role: ROLE.USER, content: TURN_ABORTED_MESSAGE };
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

  it('renders code blocks with language tag', () => {
    const messageWithCode = {
      role: ROLE.ASSISTANT,
      content: 'Here is some code:\n\n```typescript\nconst x = 1;\n```',
    };
    const { lastFrame } = render(
      <Messages messages={[messageWithCode]} isLoading={false} />,
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('Here is some code:');
    expect(frame).toContain('TYPESCRIPT');
    expect(frame).toContain('const x = 1;');
  });

  it('renders code blocks without language tag', () => {
    const messageWithCode = {
      role: ROLE.ASSISTANT,
      content: '```\nplain code\n```',
    };
    const { lastFrame } = render(
      <Messages messages={[messageWithCode]} isLoading={false} />,
    );
    expect(lastFrame()).toContain('plain code');
  });

  it('renders multiple code blocks in one message', () => {
    const messageWithMultipleCode = {
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
    expect(frame).toContain('JS');
    expect(frame).toContain('PYTHON');
    expect(frame).toContain('const a = 1;');
    expect(frame).toContain('x = 2');
  });

  it('renders text before and after code blocks', () => {
    const messageWithSurroundingText = {
      role: ROLE.ASSISTANT,
      content: 'Before code\n```ts\nconst x = 1;\n```\nAfter code',
    };
    const { lastFrame } = render(
      <Messages messages={[messageWithSurroundingText]} isLoading={false} />,
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('Before code');
    expect(frame).toContain('After code');
    expect(frame).toContain('TS');
  });
});
