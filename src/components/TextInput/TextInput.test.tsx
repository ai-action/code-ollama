import { useStdout } from 'ink';
import { render } from 'ink-testing-library';

import { KEY } from '../../constants';
import { time } from '../../utils';
import { TextInput } from './TextInput';

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
}));

function setTerminalWidth(columns: number) {
  mockColumns.value = columns;
}

function stripAnsi(value: string | undefined) {
  return value?.replaceAll(new RegExp(String.raw`\u001B\[[0-9;]*m`, 'g'), '');
}

describe('TextInput', () => {
  beforeEach(() => {
    setTerminalWidth(100);
    vi.mocked(useStdout).mockClear();
  });

  it('renders placeholder when empty', () => {
    const { lastFrame } = render(
      <TextInput
        value=""
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        placeholder="Type here..."
      />,
    );
    // Placeholder shows with ANSI inverse cursor
    const frame = lastFrame();
    expect(frame).toBeTruthy();
    expect(frame).toContain('ype here');
  });

  it('wraps long values using the available width after the prompt indent', () => {
    setTerminalWidth(6);

    const { lastFrame } = render(
      <TextInput
        value="abcdefg"
        cursorPosition={3}
        wrapIndent={2}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(stripAnsi(lastFrame())).toBe('abcd\nefg');
  });

  it('renders value when not empty', () => {
    const { lastFrame } = render(
      <TextInput
        value="hello"
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        placeholder="Type here..."
      />,
    );
    // Value shows with ANSI inverse cursor
    const frame = lastFrame();
    expect(frame).toBeTruthy();
    expect(frame).toContain('hell');
  });

  it('renders wrapped text when the cursor is on a continuation line', () => {
    setTerminalWidth(6);

    const { lastFrame } = render(
      <TextInput
        value="abcdefg"
        cursorPosition={4}
        wrapIndent={2}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(stripAnsi(lastFrame())).toBe('abcd\nefg');
  });

  it('renders a wrapped placeholder using the prompt indent width', () => {
    setTerminalWidth(8);

    const { lastFrame } = render(
      <TextInput
        value=""
        placeholder="placeholder"
        wrapIndent={2}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(stripAnsi(lastFrame())).toBe('placeh\nolder');
  });

  it('calls onSubmit when Enter is pressed', async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(
      <TextInput value="test" onChange={vi.fn()} onSubmit={onSubmit} />,
    );
    stdin.write(KEY.ENTER);
    await time.tick();
    expect(onSubmit).toHaveBeenCalledWith('test');
  });

  it('ignores input when disabled', async () => {
    const onChange = vi.fn();
    const { stdin } = render(
      <TextInput
        value=""
        isDisabled
        onChange={onChange}
        onSubmit={vi.fn()}
        placeholder="Type here..."
      />,
    );
    stdin.write('a');
    await time.tick();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('ignores submit when disabled', async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(
      <TextInput
        value="test"
        isDisabled
        onChange={vi.fn()}
        onSubmit={onSubmit}
      />,
    );
    stdin.write(KEY.ENTER);
    await time.tick();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('calls onChange when typing', async () => {
    const onChange = vi.fn();
    const { stdin } = render(
      <TextInput value="" onChange={onChange} onSubmit={vi.fn()} />,
    );
    stdin.write('a');
    await time.tick();
    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('handles backspace to delete last character', async () => {
    const onChange = vi.fn();
    const { stdin } = render(
      <TextInput value="ab" onChange={onChange} onSubmit={vi.fn()} />,
    );
    stdin.write(KEY.BACKSPACE);
    await time.tick();
    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('ignores backspace when cursor at start', async () => {
    const onChange = vi.fn();
    const { stdin } = render(
      <TextInput value="a" onChange={onChange} onSubmit={vi.fn()} />,
    );
    stdin.write(KEY.LEFT);
    await time.tick();
    stdin.write(KEY.BACKSPACE);
    await time.tick();
    // onChange should not be called because cursor is at start
    expect(onChange).toHaveBeenCalledTimes(0);
  });

  it('handles cursor movement keys', async () => {
    const { stdin } = render(
      <TextInput value="abc" onChange={vi.fn()} onSubmit={vi.fn()} />,
    );
    stdin.write(KEY.LEFT);
    await time.tick();
    stdin.write(KEY.RIGHT);
    await time.tick();
    stdin.write(KEY.HOME);
    await time.tick();
    stdin.write(KEY.END);
    await time.tick();
  });

  it('moves the cursor to the start on Ctrl+A', async () => {
    const onChange = vi.fn();
    const { stdin } = render(
      <TextInput value="hello" onChange={onChange} onSubmit={vi.fn()} />,
    );

    stdin.write(KEY.CTRL_A);
    await time.tick();
    stdin.write('X');
    await time.tick();

    expect(onChange).toHaveBeenCalledWith('Xhello');
  });

  it('moves the cursor to the end on Ctrl+E', async () => {
    const onChange = vi.fn();
    const { stdin } = render(
      <TextInput value="hello" onChange={onChange} onSubmit={vi.fn()} />,
    );

    stdin.write(KEY.HOME);
    await time.tick();
    stdin.write(KEY.CTRL_E);
    await time.tick();
    stdin.write('X');
    await time.tick();

    expect(onChange).toHaveBeenCalledWith('helloX');
  });

  it('ignores arrow keys and ctrl keys when disabled', async () => {
    const { stdin } = render(
      <TextInput
        value="test"
        isDisabled
        onChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );
    stdin.write(KEY.LEFT);
    await time.tick();
    stdin.write(KEY.RIGHT);
    await time.tick();
    stdin.write(KEY.CTRL_C);
    await time.tick();
  });

  it('keeps cursor position when typing after moving left', async () => {
    const onChange = vi.fn();
    const { stdin } = render(
      <TextInput value="hello" onChange={onChange} onSubmit={vi.fn()} />,
    );
    // Move cursor left twice (to position 3)
    stdin.write(KEY.LEFT);
    await time.tick();
    stdin.write(KEY.LEFT);
    await time.tick();
    // Type a character - should insert at position 3, cursor at 4
    stdin.write('X');
    await time.tick();
    expect(onChange).toHaveBeenCalledWith('helXlo');
  });

  it('syncs external cursorPosition prop', async () => {
    const { lastFrame, rerender } = render(
      <TextInput value="hello world" onChange={vi.fn()} onSubmit={vi.fn()} />,
    );
    // Initially cursor is at end (position 11)
    expect(lastFrame()).toContain('hello worl');

    // Change cursor position via prop
    rerender(
      <TextInput
        value="hello world"
        cursorPosition={5}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );
    await time.tick();
    // Cursor should now be at position 5 (after 'hello')
    expect(lastFrame()).toContain('hello');
    expect(lastFrame()).toContain('world');
  });

  it('applies wrapped external cursor positions to editing', async () => {
    setTerminalWidth(8);
    const onChange = vi.fn();

    const { stdin, rerender } = render(
      <TextInput
        value="abcdefghij"
        wrapIndent={1}
        onChange={onChange}
        onSubmit={vi.fn()}
      />,
    );

    rerender(
      <TextInput
        value="abcdefghij"
        cursorPosition={7}
        wrapIndent={1}
        onChange={onChange}
        onSubmit={vi.fn()}
      />,
    );
    await time.tick();

    stdin.write(KEY.BACKSPACE);
    await time.tick();

    expect(onChange).toHaveBeenCalledWith('abcdefhij');
  });

  it('renders wrapped long values for externally supplied cursor positions', async () => {
    setTerminalWidth(8);

    const { lastFrame, rerender } = render(
      <TextInput
        value="src/components/Chat/Input.tsx "
        wrapIndent={2}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    rerender(
      <TextInput
        value="src/components/Chat/Input.tsx "
        cursorPosition={29}
        wrapIndent={2}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );
    await time.tick();

    expect(stripAnsi(lastFrame())).toBe(
      'src/co\nmponen\nts/Cha\nt/Inpu\nt.tsx',
    );
  });
});
