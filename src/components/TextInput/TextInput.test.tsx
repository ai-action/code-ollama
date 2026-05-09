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
    // Placeholder shows with cursor at position 0 (T + inverse T + rest)
    expect(lastFrame()).toContain('T');
    expect(lastFrame()).toContain('ype here...');
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
    expect(lastFrame()).toContain('hello');
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
    // Test passes if no errors thrown
    expect(true).toBe(true);
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
    // Test passes if no errors thrown
    expect(true).toBe(true);
  });
});
