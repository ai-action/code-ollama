import { KEY } from '@/constants';
import { time } from '@/utils';
import { renderWithTheme } from '@/utils/testing';

import { CommandMenu, isSubmittableCommand } from './CommandMenu';

describe('CommandMenu', () => {
  it.each([
    ['/models', true],
    ['/host', true],
    ['/memory', true],
    ['/memory s', true],
    ['/memory path', true],
    ['/memory add', false],
    ['/memory add ', false],
    ['/memory add Use Vitest.', true],
    ['/memory add --global', false],
    ['/memory add --global Use Vitest.', true],
    ['/unknown', false],
  ])('reports whether %s is submittable', (command, expected) => {
    expect(isSubmittableCommand(command)).toBe(expected);
  });

  it('returns null when input does not start with a slash', () => {
    const onSubmit = vi.fn();
    const { lastFrame } = renderWithTheme(
      <CommandMenu input="hello" onSubmit={onSubmit} />,
    );

    expect(lastFrame()).toBe('');
  });

  it('returns null when no commands match the slash input', () => {
    const onSubmit = vi.fn();
    const { lastFrame } = renderWithTheme(
      <CommandMenu input="/x" onSubmit={onSubmit} />,
    );

    expect(lastFrame()).toBe('');
  });

  it('renders matching commands and selects with Enter', async () => {
    const onSubmit = vi.fn();
    const { lastFrame, stdin } = renderWithTheme(
      <CommandMenu input="/m" onSubmit={onSubmit} />,
    );

    expect(lastFrame()).toContain('/models - manage Ollama models');
    expect(lastFrame()).toContain('/mcp - show MCP server status');
    expect(lastFrame()).not.toContain('/clear - clear the current session');

    stdin.write(KEY.ENTER);
    await time.tick();

    expect(onSubmit).toHaveBeenCalledWith('/models');
  });

  it('completes a top-level command with Tab instead of submitting', async () => {
    const onComplete = vi.fn();
    const onSubmit = vi.fn();
    const { stdin } = renderWithTheme(
      <CommandMenu input="/mo" onComplete={onComplete} onSubmit={onSubmit} />,
    );

    stdin.write(KEY.TAB);
    await time.tick();

    expect(onComplete).toHaveBeenCalledWith('/models');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('includes /mcp in matching command results', () => {
    const onSubmit = vi.fn();
    const { lastFrame } = renderWithTheme(
      <CommandMenu input="/mc" onSubmit={onSubmit} />,
    );

    expect(lastFrame()).toContain('/mcp - show MCP server status');
  });

  it('includes /host in matching command results', () => {
    const { lastFrame } = renderWithTheme(
      <CommandMenu input="/ho" onSubmit={vi.fn()} />,
    );

    expect(lastFrame()).toContain('/host - configure the Ollama host');
  });

  it('completes /mem to /memory space instead of submitting', async () => {
    const onComplete = vi.fn();
    const onSubmit = vi.fn();
    const { stdin } = renderWithTheme(
      <CommandMenu input="/mem" onComplete={onComplete} onSubmit={onSubmit} />,
    );

    stdin.write(KEY.TAB);
    await time.tick();

    expect(onComplete).toHaveBeenCalledWith('/memory ');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('completes exact /memory with Tab instead of submitting', async () => {
    const onComplete = vi.fn();
    const onSubmit = vi.fn();
    const { stdin } = renderWithTheme(
      <CommandMenu
        input="/memory"
        onComplete={onComplete}
        onSubmit={onSubmit}
      />,
    );

    stdin.write(KEY.TAB);
    await time.tick();

    expect(onComplete).toHaveBeenCalledWith('/memory');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits exact /memory when selected', async () => {
    const onComplete = vi.fn();
    const onSubmit = vi.fn();
    const { stdin } = renderWithTheme(
      <CommandMenu
        input="/memory"
        onComplete={onComplete}
        onSubmit={onSubmit}
      />,
    );

    stdin.write(KEY.ENTER);
    await time.tick();

    expect(onSubmit).toHaveBeenCalledWith('/memory');
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('renders memory subcommands after /memory space', () => {
    const onSubmit = vi.fn();
    const { lastFrame } = renderWithTheme(
      <CommandMenu input="/memory " onSubmit={onSubmit} />,
    );

    expect(lastFrame()).toContain('/memory show - display loaded memory');
    expect(lastFrame()).toContain('/memory add <text>');
  });

  it('completes memory add instead of submitting it', async () => {
    const onComplete = vi.fn();
    const onSubmit = vi.fn();
    const { stdin } = renderWithTheme(
      <CommandMenu
        input="/memory a"
        onComplete={onComplete}
        onSubmit={onSubmit}
      />,
    );

    stdin.write(KEY.TAB);
    await time.tick();

    expect(onComplete).toHaveBeenCalledWith('/memory add ');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits memory show when selected', async () => {
    const onComplete = vi.fn();
    const onSubmit = vi.fn();
    const { stdin } = renderWithTheme(
      <CommandMenu
        input="/memory sh"
        onComplete={onComplete}
        onSubmit={onSubmit}
      />,
    );

    stdin.write(KEY.ENTER);
    await time.tick();

    expect(onSubmit).toHaveBeenCalledWith('/memory show');
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('calls onComplete via onSelect when selecting a non-submittable memory add option with Enter', async () => {
    const onComplete = vi.fn();
    const onSubmit = vi.fn();
    const { stdin } = renderWithTheme(
      <CommandMenu
        input="/memory a"
        onComplete={onComplete}
        onSubmit={onSubmit}
      />,
    );

    stdin.write(KEY.ENTER);
    await time.tick();

    expect(onComplete).toHaveBeenCalledWith('/memory add ');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('moves focus through slash commands before selecting', async () => {
    const onSubmit = vi.fn();
    const { stdin } = renderWithTheme(
      <CommandMenu input="/" onSubmit={onSubmit} />,
    );

    stdin.write(KEY.DOWN);
    await time.tick();
    stdin.write(KEY.ENTER);
    await time.tick();

    expect(onSubmit).toHaveBeenCalledWith('/compact');
  });

  it('includes /compact in matching command results', () => {
    const onSubmit = vi.fn();
    const { lastFrame } = renderWithTheme(
      <CommandMenu input="/co" onSubmit={onSubmit} />,
    );

    expect(lastFrame()).toContain(
      '/compact - summarize conversation and prune context',
    );
  });

  it('includes /search in matching command results', () => {
    const onSubmit = vi.fn();
    const { lastFrame } = renderWithTheme(
      <CommandMenu input="/s" onSubmit={onSubmit} />,
    );

    expect(lastFrame()).toContain('/search - configure web search');
  });

  it('includes /theme in matching command results', () => {
    const onSubmit = vi.fn();
    const { lastFrame } = renderWithTheme(
      <CommandMenu input="/t" onSubmit={onSubmit} />,
    );

    expect(lastFrame()).toContain('/theme - change the theme');
  });
});
