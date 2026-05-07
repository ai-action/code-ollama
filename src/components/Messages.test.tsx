import { Text } from 'ink';
import { render } from 'ink-testing-library';

import { ROLE, UI } from '../constants';
import { Messages } from './Messages';

vi.mock('@inkjs/ui', () => ({
  Spinner: ({ label }: { label?: string }) => <Text>{`⏳${label ?? ''}`}</Text>,
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
    } as unknown as import('../utils/ollama').Message;
    const { lastFrame } = render(
      <Messages messages={[unknownMessage]} isLoading={false} />,
    );
    expect(lastFrame()).toContain('test');
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
});
