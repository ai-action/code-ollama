import { render } from 'ink-testing-library';

import { KEY } from '@/constants';
import { time } from '@/utils';

import { Suggestions } from './Suggestions';

describe('Suggestions', () => {
  it('renders options and highlights the first one', () => {
    const onHighlight = vi.fn();
    const { lastFrame } = render(
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

  it('moves focus with arrow keys and selects with Tab', async () => {
    const onHighlight = vi.fn();
    const onSelect = vi.fn();
    const { stdin } = render(
      <Suggestions
        options={[
          { label: 'alpha', value: 'alpha' },
          { label: 'beta', value: 'beta' },
        ]}
        onHighlight={onHighlight}
        onSelect={onSelect}
      />,
    );

    stdin.write(KEY.DOWN);
    await time.tick();
    stdin.write(KEY.TAB);
    await time.tick();

    expect(onHighlight).toHaveBeenLastCalledWith({
      label: 'beta',
      value: 'beta',
    });
    expect(onSelect).toHaveBeenCalledWith({
      label: 'beta',
      value: 'beta',
    });
  });

  it('returns null when options are empty', () => {
    const { lastFrame } = render(
      <Suggestions options={[]} onSelect={vi.fn()} />,
    );

    expect(lastFrame()).toBe('');
  });

  it('calls onHighlight with null and resets focus when options become empty', async () => {
    const onHighlight = vi.fn();
    const { rerender } = render(
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
    const { lastFrame } = render(
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
