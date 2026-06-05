import { render } from 'ink-testing-library';

import { KEY } from '@/constants';
import { time } from '@/utils';

import { CommandMenu } from './CommandMenu';

describe('CommandMenu', () => {
  it('returns null when input does not start with a slash', () => {
    const onSubmit = vi.fn();
    const { lastFrame } = render(
      <CommandMenu input="hello" onSubmit={onSubmit} />,
    );

    expect(lastFrame()).toBe('');
  });

  it('returns null when no commands match the slash input', () => {
    const onSubmit = vi.fn();
    const { lastFrame } = render(
      <CommandMenu input="/x" onSubmit={onSubmit} />,
    );

    expect(lastFrame()).toBe('');
  });

  it('renders matching commands and selects with Enter', async () => {
    const onSubmit = vi.fn();
    const { lastFrame, stdin } = render(
      <CommandMenu input="/m" onSubmit={onSubmit} />,
    );

    expect(lastFrame()).toContain('/model - manage Ollama models');
    expect(lastFrame()).not.toContain('/clear - clear the current session');

    stdin.write(KEY.ENTER);
    await time.tick();

    expect(onSubmit).toHaveBeenCalledWith('/model');
  });

  it('moves focus through slash commands before selecting', async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(<CommandMenu input="/" onSubmit={onSubmit} />);

    stdin.write(KEY.DOWN);
    await time.tick();
    stdin.write(KEY.ENTER);
    await time.tick();

    expect(onSubmit).toHaveBeenCalledWith('/compact');
  });

  it('includes /compact in matching command results', () => {
    const onSubmit = vi.fn();
    const { lastFrame } = render(
      <CommandMenu input="/co" onSubmit={onSubmit} />,
    );

    expect(lastFrame()).toContain(
      '/compact - summarize conversation and prune context',
    );
  });

  it('includes /search in matching command results', () => {
    const onSubmit = vi.fn();
    const { lastFrame } = render(
      <CommandMenu input="/s" onSubmit={onSubmit} />,
    );

    expect(lastFrame()).toContain('/search - configure web search');
  });

  it('includes /theme in matching command results', () => {
    const onSubmit = vi.fn();
    const { lastFrame } = render(
      <CommandMenu input="/t" onSubmit={onSubmit} />,
    );

    expect(lastFrame()).toContain('/theme - change the theme');
  });
});
