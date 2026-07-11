import { KEY } from '@/constants';
import { time } from '@/utils';
import { renderWithTheme } from '@/utils/testing';

import { Suggestions } from './Suggestions';

describe('Suggestions', () => {
  it('renders options and highlights the first one', () => {
    const onHighlight = vi.fn();
    const { lastFrame } = renderWithTheme(
      <Suggestions
        options={[
          { label: 'alpha', value: 'alpha' },
          { label: 'beta', value: 'beta' },
        ]}
        onHighlight={onHighlight}
        onSelect={vi.fn()}
      />,
    );

    expect(lastFrame()).toContain('alpha');
    expect(lastFrame()).toContain('beta');
    expect(onHighlight).toHaveBeenLastCalledWith({
      label: 'alpha',
      value: 'alpha',
    });
  });

  it.each([
    {
      keys: [KEY.DOWN, KEY.TAB],
      expectedLabel: 'beta',
      description: 'selects with Tab',
    },
    {
      keys: [KEY.DOWN, KEY.UP, KEY.ENTER],
      expectedLabel: 'alpha',
      description: 'selects with Enter after navigating up',
    },
  ])(
    'moves focus with arrow keys and $description',
    async ({ keys, expectedLabel }) => {
      const onHighlight = vi.fn();
      const onSelect = vi.fn();
      const { stdin } = renderWithTheme(
        <Suggestions
          options={[
            { label: 'alpha', value: 'alpha' },
            { label: 'beta', value: 'beta' },
          ]}
          onHighlight={onHighlight}
          onSelect={onSelect}
        />,
      );

      for (const key of keys) {
        stdin.write(key);
        await time.tick();
      }

      expect(onHighlight).toHaveBeenLastCalledWith({
        label: expectedLabel,
        value: expectedLabel,
      });
      expect(onSelect).toHaveBeenCalledWith({
        label: expectedLabel,
        value: expectedLabel,
      });
    },
  );

  it('calls onComplete instead of onSelect when Tab is pressed and onComplete is provided', async () => {
    const onComplete = vi.fn();
    const onSelect = vi.fn();
    const { stdin } = renderWithTheme(
      <Suggestions
        options={[
          { label: 'alpha', value: 'alpha' },
          { label: 'beta', value: 'beta' },
        ]}
        onComplete={onComplete}
        onSelect={onSelect}
      />,
    );

    stdin.write(KEY.TAB);
    await time.tick();

    expect(onComplete).toHaveBeenCalledWith({
      label: 'alpha',
      value: 'alpha',
    });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('ignores unrelated printable input', async () => {
    const onSelect = vi.fn();
    const { stdin } = renderWithTheme(
      <Suggestions
        options={[
          { label: 'alpha', value: 'alpha' },
          { label: 'beta', value: 'beta' },
        ]}
        onSelect={onSelect}
      />,
    );

    stdin.write('x');
    await time.tick();

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('returns null when options are empty', () => {
    const { lastFrame } = renderWithTheme(
      <Suggestions options={[]} onSelect={vi.fn()} />,
    );

    expect(lastFrame()).toBe('');
  });

  it('ignores keyboard input while disabled', async () => {
    const onHighlight = vi.fn();
    const onSelect = vi.fn();
    const { stdin } = renderWithTheme(
      <Suggestions
        isDisabled
        options={[
          { label: 'alpha', value: 'alpha' },
          { label: 'beta', value: 'beta' },
        ]}
        onHighlight={onHighlight}
        onSelect={onSelect}
      />,
    );

    await time.tick();
    stdin.write(KEY.DOWN);
    await time.tick();
    stdin.write(KEY.ENTER);
    await time.tick();

    expect(onHighlight).toHaveBeenLastCalledWith({
      label: 'alpha',
      value: 'alpha',
    });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('calls onHighlight with null and resets focus when options become empty', async () => {
    const onHighlight = vi.fn();
    const { rerender } = renderWithTheme(
      <Suggestions
        options={[
          { label: 'alpha', value: 'alpha' },
          { label: 'beta', value: 'beta' },
        ]}
        onHighlight={onHighlight}
        onSelect={vi.fn()}
      />,
    );

    await time.tick();

    rerender(
      <Suggestions options={[]} onHighlight={onHighlight} onSelect={vi.fn()} />,
    );
    await time.tick();

    expect(onHighlight).toHaveBeenLastCalledWith(null);
  });

  it('limits visible options to five', () => {
    const { lastFrame } = renderWithTheme(
      <Suggestions
        options={[
          { label: '1', value: '1' },
          { label: '2', value: '2' },
          { label: '3', value: '3' },
          { label: '4', value: '4' },
          { label: '5', value: '5' },
          { label: '6', value: '6' },
        ]}
        onSelect={vi.fn()}
      />,
    );

    const frame = lastFrame() ?? '';
    expect(frame).toContain('1');
    expect(frame).toContain('5');
    expect(frame).not.toContain('6');
  });
});
