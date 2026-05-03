import { render } from 'ink-testing-library';

import { Chat } from './Chat';

const ENTER = '\r';

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

type Stdin = ReturnType<typeof render>['stdin'];

async function typeText(stdin: Stdin, text: string) {
  for (const char of text) {
    stdin.write(char);
    await tick();
  }
}

describe('Chat', () => {
  it('renders input prompt', () => {
    const { lastFrame } = render(<Chat />);
    expect(lastFrame()).toContain('>');
  });

  it('shows message after submit', async () => {
    const { lastFrame, stdin } = render(<Chat />);
    await typeText(stdin, 'hello');
    stdin.write(ENTER);
    await tick();
    expect(lastFrame()).toContain('hello');
  });

  it('clears input after submit', async () => {
    const { lastFrame, stdin } = render(<Chat />);
    await typeText(stdin, 'hello');
    stdin.write(ENTER);
    await tick();
    const frame = lastFrame() ?? '';
    const inputLine =
      frame.split('\n').find((line) => line.includes('>')) ?? '';
    expect(inputLine.replace('>', '').trim()).toBe('');
  });

  it('does not add blank messages', async () => {
    const { lastFrame, stdin } = render(<Chat />);
    await typeText(stdin, '   ');
    stdin.write(ENTER);
    await tick();
    const frame = lastFrame() ?? '';
    const lines = frame
      .split('\n')
      .filter((line) => line.trim() && !line.includes('>'));
    expect(lines).toHaveLength(0);
  });

  it('shows multiple messages in order', async () => {
    const { lastFrame, stdin } = render(<Chat />);
    await typeText(stdin, 'first');
    stdin.write(ENTER);
    await tick();
    await typeText(stdin, 'second');
    stdin.write(ENTER);
    await tick();
    const frame = lastFrame() ?? '';
    const firstIdx = frame.indexOf('first');
    const secondIdx = frame.indexOf('second');
    expect(firstIdx).toBeGreaterThanOrEqual(0);
    expect(secondIdx).toBeGreaterThan(firstIdx);
  });
});
