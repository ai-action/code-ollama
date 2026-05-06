import { render } from 'ink-testing-library';

import { KEY } from '../constants';
import { tick } from '../utils/test';
import { ChatInput } from './ChatInput';

describe('ChatInput', () => {
  it('renders input prompt', () => {
    const { lastFrame } = render(<ChatInput onSubmit={vi.fn()} />);
    expect(lastFrame()).toContain('>');
  });

  it('does not show command suggestion on non-slash input', async () => {
    const { lastFrame, stdin } = render(<ChatInput onSubmit={vi.fn()} />);
    stdin.write('h');
    await tick();
    expect(lastFrame()).not.toContain('/model');
  });

  it('shows inline command suggestion when typing /', async () => {
    const { lastFrame, stdin } = render(<ChatInput onSubmit={vi.fn()} />);
    stdin.write('/');
    await tick();
    expect(lastFrame()).toContain('/model');
  });

  it('submits typed text on Enter', async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(<ChatInput onSubmit={onSubmit} />);
    stdin.write('h');
    await tick();
    stdin.write('i');
    await tick();
    stdin.write(KEY.ENTER);
    await tick();
    expect(onSubmit).toHaveBeenCalledWith('hi');
  });

  it('submits completed slash command on Enter when suggestion is visible', async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(<ChatInput onSubmit={onSubmit} />);
    stdin.write('/');
    await tick();
    stdin.write(KEY.ENTER);
    await tick();
    expect(onSubmit).toHaveBeenCalledWith('/model');
  });

  it('does not submit blank input', async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(<ChatInput onSubmit={onSubmit} />);
    stdin.write(KEY.ENTER);
    await tick();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('clears input after submit', async () => {
    const { lastFrame, stdin } = render(<ChatInput onSubmit={vi.fn()} />);
    stdin.write('h');
    await tick();
    stdin.write('i');
    await tick();
    stdin.write(KEY.ENTER);
    await tick();
    expect(lastFrame()).not.toContain('hi');
  });

  it('deletes last character on backspace', async () => {
    const { lastFrame, stdin } = render(<ChatInput onSubmit={vi.fn()} />);
    stdin.write('/');
    await tick();
    stdin.write('m');
    await tick();
    stdin.write(KEY.BACKSPACE);
    await tick();
    expect(lastFrame()).toContain('/model');
    stdin.write(KEY.BACKSPACE);
    await tick();
    expect(lastFrame()).not.toContain('/model');
  });

  it('does not accept input when disabled', async () => {
    const onSubmit = vi.fn();
    const { lastFrame, stdin } = render(
      <ChatInput isDisabled onSubmit={onSubmit} />,
    );
    stdin.write('h');
    await tick();
    expect(lastFrame()).not.toContain('h');
    stdin.write(KEY.ENTER);
    await tick();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
