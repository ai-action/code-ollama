import { render } from 'ink-testing-library';

import { tick } from '../utils/test';

vi.mock('../constants', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../constants')>();
  return {
    ...actual,
    COMMANDS: [
      { name: '/model', description: 'Switch the active model' },
      { name: '/mock', description: 'Mock command' },
    ],
  };
});

import { KEY } from '../constants';
import { Autocomplete } from './Autocomplete';

describe('Autocomplete', () => {
  it('renders input prompt', () => {
    const { lastFrame } = render(<Autocomplete onSubmit={vi.fn()} />);
    expect(lastFrame()).toContain('>');
  });

  it('does not show suggestions on non-slash input', async () => {
    const { lastFrame, stdin } = render(<Autocomplete onSubmit={vi.fn()} />);
    stdin.write('h');
    await tick();
    expect(lastFrame()).not.toContain('/model');
  });

  it('shows suggestions when typing /', async () => {
    const { lastFrame, stdin } = render(<Autocomplete onSubmit={vi.fn()} />);
    stdin.write('/');
    await tick();
    expect(lastFrame()).toContain('/model');
    expect(lastFrame()).toContain('Switch the active model');
  });

  it('filters suggestions as input narrows', async () => {
    const { lastFrame, stdin } = render(<Autocomplete onSubmit={vi.fn()} />);
    stdin.write('/');
    await tick();
    stdin.write('m');
    await tick();
    expect(lastFrame()).toContain('/model');
    stdin.write('x');
    await tick();
    expect(lastFrame()).not.toContain('/model');
  });

  it('completes suggestion on Tab', async () => {
    const { lastFrame, stdin } = render(<Autocomplete onSubmit={vi.fn()} />);
    stdin.write('/');
    await tick();
    stdin.write(KEY.TAB);
    await tick();
    expect(lastFrame()).toContain('/model');
  });

  it('submits completed value on Enter after Tab', async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(<Autocomplete onSubmit={onSubmit} />);
    stdin.write('/');
    await tick();
    stdin.write(KEY.TAB);
    await tick();
    stdin.write(KEY.ENTER);
    await tick();
    expect(onSubmit).toHaveBeenCalledWith('/model');
  });

  it('submits typed text on Enter without suggestion selected', async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(<Autocomplete onSubmit={onSubmit} />);
    stdin.write('h');
    await tick();
    stdin.write('i');
    await tick();
    stdin.write(KEY.ENTER);
    await tick();
    expect(onSubmit).toHaveBeenCalledWith('hi');
  });

  it('does not submit blank input', async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(<Autocomplete onSubmit={onSubmit} />);
    stdin.write(KEY.ENTER);
    await tick();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('clears input after submit', async () => {
    const { lastFrame, stdin } = render(<Autocomplete onSubmit={vi.fn()} />);
    stdin.write('h');
    await tick();
    stdin.write('i');
    await tick();
    stdin.write(KEY.ENTER);
    await tick();
    expect(lastFrame()).not.toContain('hi');
  });

  it('clears input and suggestions on Escape', async () => {
    const { lastFrame, stdin } = render(<Autocomplete onSubmit={vi.fn()} />);
    stdin.write('/');
    await tick();
    expect(lastFrame()).toContain('/model');
    stdin.write(KEY.ESCAPE);
    await tick(50);
    expect(lastFrame()).not.toContain('/model');
  });

  it('deletes last character on backspace', async () => {
    const { lastFrame, stdin } = render(<Autocomplete onSubmit={vi.fn()} />);
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
      <Autocomplete isDisabled onSubmit={onSubmit} />,
    );
    stdin.write('h');
    await tick();
    expect(lastFrame()).not.toContain('h');
    stdin.write(KEY.ENTER);
    await tick();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('moves highlight down with arrow keys', async () => {
    const { stdin } = render(<Autocomplete onSubmit={vi.fn()} />);
    stdin.write('/');
    await tick();
    stdin.write(KEY.DOWN);
    await tick();
    stdin.write(KEY.UP);
    await tick();
  });

  it('submits highlighted suggestion on Enter', async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(<Autocomplete onSubmit={onSubmit} />);
    stdin.write('/');
    await tick();
    stdin.write(KEY.ENTER);
    await tick();
    expect(onSubmit).toHaveBeenCalledWith('/model');
  });

  it('shows non-highlighted suggestions when arrow down moves selection', async () => {
    const { lastFrame, stdin } = render(<Autocomplete onSubmit={vi.fn()} />);
    stdin.write('/');
    await tick();
    expect(lastFrame()).toContain('/model');
    expect(lastFrame()).toContain('/mock');
    stdin.write(KEY.DOWN);
    await tick();
    expect(lastFrame()).toContain('/mock');
  });
});
