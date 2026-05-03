import { render } from 'ink-testing-library';

import { Chat } from './Chat';

vi.mock('../utils/ollama', () => ({
  streamChat: vi.fn().mockImplementation(function* () {
    yield 'Mocked';
    yield ' response';
  }),
}));

const ENTER = '\r';

const tick = (ms = 0) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

type Stdin = ReturnType<typeof render>['stdin'];

async function typeText(stdin: Stdin, text: string) {
  for (const char of text) {
    stdin.write(char);
    await tick();
  }
}

async function waitForStream() {
  // Allow time for async generator to yield values
  await tick(10);
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
    await waitForStream();
    expect(lastFrame()).toContain('hello');
  });

  it('clears input after submit', async () => {
    const { lastFrame, stdin } = render(<Chat />);
    await typeText(stdin, 'hello');
    stdin.write(ENTER);
    await waitForStream();
    const frame = lastFrame() ?? '';
    // Find the last line that contains just the prompt (no user text after >)
    const lines = frame.split('\n');
    const inputLine = lines.find((line) => line.trim() === '>') ?? '';
    expect(inputLine.trim()).toBe('>');
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
    await waitForStream();
    await typeText(stdin, 'second');
    stdin.write(ENTER);
    await waitForStream();
    const frame = lastFrame() ?? '';
    const firstIdx = frame.indexOf('first');
    const secondIdx = frame.indexOf('second');
    expect(firstIdx).toBeGreaterThanOrEqual(0);
    expect(secondIdx).toBeGreaterThan(firstIdx);
  });
});

describe('Chat with error', () => {
  it('shows error message when stream fails with Error', async () => {
    const { streamChat } = await import('../utils/ollama');
    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield '';
      throw new Error('Connection failed');
    });

    const { lastFrame, stdin } = render(<Chat />);

    await typeText(stdin, 'hello');
    stdin.write(ENTER);
    await waitForStream();

    expect(lastFrame()).toContain('Error: Connection failed');
  });

  it('shows error message when stream fails with non-Error', async () => {
    const { streamChat } = await import('../utils/ollama');
    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield '';
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw { toString: () => 'Custom error' };
    });

    const { lastFrame, stdin } = render(<Chat />);

    await typeText(stdin, 'hello');
    stdin.write(ENTER);
    await waitForStream();

    expect(lastFrame()).toContain('Error: Custom error');
  });
});
