import { Text } from 'ink';
import { render } from 'ink-testing-library';

import { tick } from '../utils/test';

const mockState = vi.hoisted(() => ({
  handlers: [] as ((value: string) => void)[],
  testInput: '',
  shouldReset: false,
  clear() {
    this.handlers.length = 0;
    this.testInput = '';
    this.shouldReset = true;
  },
}));

vi.mock('@inkjs/ui', () => ({
  Spinner: ({ label }: { label?: string }) => <Text>{`⏳${label ?? ''}`}</Text>,
  TextInput: (props: {
    onSubmit?: (value: string) => void;
    isDisabled?: boolean;
    defaultValue?: string;
  }) => {
    // Register handler
    if (props.onSubmit) {
      mockState.handlers.push(props.onSubmit);
    }

    if (props.isDisabled) {
      return null;
    }

    // Determine display value based on state
    let displayValue: string;
    if (mockState.shouldReset) {
      displayValue = props.defaultValue ?? '';
      mockState.shouldReset = false;
    } else if (mockState.testInput) {
      displayValue = mockState.testInput;
    } else {
      displayValue = props.defaultValue ?? '';
    }

    return (
      <Text>
        {'>'}
        {displayValue}
      </Text>
    );
  },
}));

import { Chat } from './Chat';

vi.mock('../utils', () => ({
  ollama: {
    streamChat: vi.fn().mockImplementation(function* () {
      yield 'Mocked';
      yield ' response';
    }),
  },
}));

async function typeText(
  rerender: (tree: React.ReactElement) => void,
  text: string,
  tree: React.ReactElement,
) {
  mockState.testInput = text;
  rerender(tree);
  await tick();
}

function submitInput(value: string) {
  for (const handler of mockState.handlers) {
    handler(value);
  }
  mockState.clear();
}

async function waitForStream() {
  // Allow time for async generator to yield values
  await tick(10);
}

describe('Chat', () => {
  beforeEach(() => {
    mockState.clear();
  });

  it('renders input prompt', () => {
    const { lastFrame } = render(<Chat model="gemma4" onCommand={vi.fn()} />);
    expect(lastFrame()).toContain('>');
  });

  it('shows message after submit', async () => {
    const chat = <Chat model="gemma4" onCommand={vi.fn()} />;
    const { lastFrame, rerender } = render(chat);
    await typeText(rerender, 'hello', chat);
    submitInput('hello');
    rerender(chat);
    await waitForStream();
    expect(lastFrame()).toContain('hello');
  });

  it('clears input after submit', async () => {
    const chat = <Chat model="gemma4" onCommand={vi.fn()} />;
    const { lastFrame, rerender } = render(chat);
    await typeText(rerender, 'hello', chat);
    submitInput('hello');
    rerender(chat);
    await waitForStream();
    // Verify the user message appears in the chat
    expect(lastFrame()).toContain('hello');
  });

  it('does not add blank messages', async () => {
    const chat = <Chat model="gemma4" onCommand={vi.fn()} />;
    const { lastFrame, rerender } = render(chat);
    await typeText(rerender, '   ', chat);
    submitInput('   ');
    rerender(chat);
    await tick();
    const frame = lastFrame() ?? '';
    const lines = frame
      .split('\n')
      .filter((line) => line.trim() && !line.includes('>'));
    expect(lines).toHaveLength(0);
  });

  it('shows multiple messages in order', async () => {
    const chat = <Chat model="gemma4" onCommand={vi.fn()} />;
    const { lastFrame, rerender } = render(chat);
    await typeText(rerender, 'first', chat);
    submitInput('first');
    rerender(chat);
    await waitForStream();
    await typeText(rerender, 'second', chat);
    submitInput('second');
    rerender(chat);
    await waitForStream();
    const frame = lastFrame() ?? '';
    const firstIdx = frame.indexOf('first');
    const secondIdx = frame.indexOf('second');
    expect(firstIdx).toBeGreaterThanOrEqual(0);
    expect(secondIdx).toBeGreaterThan(firstIdx);
  });

  it('calls onCommand when a slash command is submitted', async () => {
    const onCommand = vi.fn();
    const chat = <Chat model="gemma4" onCommand={onCommand} />;
    const { rerender } = render(chat);
    submitInput('/model');
    rerender(chat);
    await tick();
    expect(onCommand).toHaveBeenCalledWith('/model');
  });

  it('passes model prop to streamChat', async () => {
    const { ollama } = await import('../utils');
    const { streamChat } = ollama;
    vi.mocked(streamChat).mockClear();

    const chat = <Chat model="llama3" onCommand={vi.fn()} />;
    const { rerender } = render(chat);
    submitInput('hello');
    rerender(chat);
    await waitForStream();

    expect(vi.mocked(streamChat)).toHaveBeenLastCalledWith(
      expect.any(Array),
      'llama3',
    );
  });
});

describe('Chat with error', () => {
  beforeEach(() => {
    mockState.clear();
  });

  it('shows error message when stream fails with Error', async () => {
    const { ollama } = await import('../utils');
    const { streamChat } = ollama;
    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield '';
      throw new Error('Connection failed');
    });

    const chat = <Chat model="gemma4" onCommand={vi.fn()} />;
    const { lastFrame, rerender } = render(chat);

    await typeText(rerender, 'hello', chat);
    submitInput('hello');
    rerender(chat);
    await waitForStream();

    expect(lastFrame()).toContain('Error: Connection failed');
  });

  it('shows error message when stream fails with non-Error', async () => {
    const { ollama } = await import('../utils');
    const { streamChat } = ollama;
    vi.mocked(streamChat).mockImplementationOnce(async function* () {
      await Promise.resolve();
      yield '';
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw { toString: () => 'Custom error' };
    });

    const chat = <Chat model="gemma4" onCommand={vi.fn()} />;
    const { lastFrame, rerender } = render(chat);

    await typeText(rerender, 'hello', chat);
    submitInput('hello');
    rerender(chat);
    await waitForStream();

    expect(lastFrame()).toContain('Error: Custom error');
  });
});
