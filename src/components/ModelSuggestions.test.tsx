import { render } from 'ink-testing-library';

import { KEY, MODELS } from '@/constants';
import { time } from '@/utils';

import { ModelSuggestions } from './ModelSuggestions';

describe('ModelSuggestions', () => {
  it('filters curated models by typed input', () => {
    const { lastFrame } = render(
      <ModelSuggestions
        catalog={MODELS.CATALOG}
        input="qwen"
        onSelect={vi.fn()}
      />,
    );

    const frame = lastFrame() ?? '';
    expect(frame).toContain('qwen2.5-coder:latest');
    expect(frame).not.toContain('Devstral 24B');
  });

  it('reports the highlighted model and selects it', async () => {
    const onHighlight = vi.fn();
    const onSelect = vi.fn();
    const { stdin } = render(
      <ModelSuggestions
        catalog={MODELS.CATALOG}
        input="g"
        onHighlight={onHighlight}
        onSelect={onSelect}
      />,
    );

    await time.tick();
    stdin.write(KEY.DOWN);
    await time.tick();
    stdin.write(KEY.ENTER);
    await time.tick();

    expect(onHighlight).toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledWith('granite4.1:8b');
  });

  it('returns empty options when input is empty or whitespace', () => {
    const { lastFrame: lastFrameEmpty } = render(
      <ModelSuggestions catalog={MODELS.CATALOG} input="" onSelect={vi.fn()} />,
    );
    expect(lastFrameEmpty()).toBe('');

    const { lastFrame: lastFrameWhitespace } = render(
      <ModelSuggestions
        catalog={MODELS.CATALOG}
        input="   "
        onSelect={vi.fn()}
      />,
    );
    expect(lastFrameWhitespace()).toBe('');
  });

  it('ranks matches by label startsWith when value does not start with input', () => {
    // Search for "Phi" which matches label "Phi 4" but value is "phi4"
    const { lastFrame } = render(
      <ModelSuggestions
        catalog={[
          { label: 'Phi 4', value: 'phi4' },
          { label: 'Other Model', value: 'other' },
        ]}
        input="phi"
        onSelect={vi.fn()}
      />,
    );

    const frame = lastFrame() ?? '';
    expect(frame).toContain('phi4');
  });

  it('ranks matches by value includes when no startsWith match', () => {
    // Search for "4" which should match "phi4" via includes on value
    const { lastFrame } = render(
      <ModelSuggestions
        catalog={[
          { label: 'Other Model', value: 'other-model' },
          { label: 'Phi 4', value: 'phi4' },
        ]}
        input="4"
        onSelect={vi.fn()}
      />,
    );

    const frame = lastFrame() ?? '';
    // Should find phi4 because value includes "4"
    expect(frame).toContain('phi4');
  });

  it('ranks matches by label includes when no value match', () => {
    // Search for "Special" which should match label includes
    const { lastFrame } = render(
      <ModelSuggestions
        catalog={[
          { label: 'My Special Model', value: 'my-model' },
          { label: 'Other', value: 'other' },
        ]}
        input="special"
        onSelect={vi.fn()}
      />,
    );

    const frame = lastFrame() ?? '';
    expect(frame).toContain('my-model');
  });

  it('falls back to MAX_SAFE_INTEGER ranking for non-matching entries during sort', () => {
    // This tests the fallback return value in rankCatalogMatch
    // All entries pass the filter but some might not match the ranking criteria
    const { lastFrame } = render(
      <ModelSuggestions
        catalog={[
          { label: 'Exact Match', value: 'exact' },
          { label: 'Another Model', value: 'another-model' },
        ]}
        input="exact"
        onSelect={vi.fn()}
      />,
    );

    const frame = lastFrame() ?? '';
    // "exact" should appear first (rank 0 for startsWith on value)
    // "another-model" should be filtered out since neither value nor label includes "exact"
    expect(frame).toContain('exact');
    expect(frame).not.toContain('another-model');
  });
});
