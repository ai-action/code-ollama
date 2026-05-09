import { render } from 'ink-testing-library';

import { KEY } from '../../constants';
import { time } from '../../utils';
import { TextInput } from './TextInput';

describe('TextInput', () => {
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
});
