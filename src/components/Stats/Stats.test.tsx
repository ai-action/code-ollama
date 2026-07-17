import { UI } from '@/constants';
import { renderWithTheme } from '@/utils/testing';

import { Stats } from './Stats';

describe('Stats', () => {
  it('renders an empty state without recorded usage', () => {
    const { lastFrame } = renderWithTheme(<Stats />);

    expect(lastFrame()).toContain('No model usage recorded for this session.');
  });

  it('renders session, model, and last-call metrics', () => {
    const lastCall = {
      model: 'qwen3:8b',
      promptTokens: 1_200,
      outputTokens: 300,
      totalDurationNs: 5_000_000_000,
      loadDurationNs: 100_000_000,
      promptEvalDurationNs: 1_000_000_000,
      evalDurationNs: 3_000_000_000,
    };
    const { lastFrame } = renderWithTheme(
      <Stats
        stats={{
          modelCalls: 2,
          promptTokens: 2_500,
          outputTokens: 500,
          totalDurationNs: 65_500_000_000,
          loadDurationNs: 200_000_000,
          promptEvalDurationNs: 2_000_000_000,
          evalDurationNs: 6_000_000_000,
          models: {
            'qwen3:8b': {
              calls: 2,
              promptTokens: 2_500,
              outputTokens: 500,
              totalDurationNs: 65_500_000_000,
              loadDurationNs: 200_000_000,
              promptEvalDurationNs: 2_000_000_000,
              evalDurationNs: 6_000_000_000,
            },
          },
          lastCall,
        }}
      />,
    );
    const frame = lastFrame() ?? '';

    expect(frame).toContain('Session Stats');
    expect(frame).toContain(
      `Calls: 2 ${UI.BULLET} Input: 2,500 ${UI.BULLET} Output: 500`,
    );
    expect(frame).toContain('Ollama time: 1m 5.5s');
    expect(frame).toContain(
      `qwen3:8b: 2 calls ${UI.BULLET} 2,500 in ${UI.BULLET} 500 out`,
    );
    expect(frame).toContain('Last Call — qwen3:8b');
    expect(frame).toContain(
      `1,200 in ${UI.BULLET} 300 out ${UI.BULLET} 5.0s total`,
    );
    expect(frame).toContain('Prompt 1.0s (1,200.0 tok/s)');
    expect(frame).toContain('Generate 3.0s (100.0 tok/s)');
  });

  it('renders an unavailable rate for a zero duration', () => {
    const { lastFrame } = renderWithTheme(
      <Stats
        stats={{
          modelCalls: 1,
          promptTokens: 0,
          outputTokens: 0,
          totalDurationNs: 0,
          loadDurationNs: 0,
          promptEvalDurationNs: 0,
          evalDurationNs: 0,
          models: {
            model: {
              calls: 1,
              promptTokens: 0,
              outputTokens: 0,
              totalDurationNs: 0,
              loadDurationNs: 0,
              promptEvalDurationNs: 0,
              evalDurationNs: 0,
            },
          },
          lastCall: {
            model: 'model',
            promptTokens: 0,
            outputTokens: 0,
            totalDurationNs: 0,
            loadDurationNs: 0,
            promptEvalDurationNs: 0,
            evalDurationNs: 0,
          },
        }}
      />,
    );

    expect(lastFrame()).toContain('Prompt 0ms (—)');
    expect(lastFrame()).toContain('Generate 0ms (—)');
  });

  it('sorts models by calls and breaks ties alphabetically', () => {
    const { lastFrame } = renderWithTheme(
      <Stats
        stats={{
          modelCalls: 2,
          promptTokens: 200,
          outputTokens: 40,
          totalDurationNs: 10_000_000_000,
          loadDurationNs: 200_000_000,
          promptEvalDurationNs: 1_000_000_000,
          evalDurationNs: 5_000_000_000,
          models: {
            zebra: {
              calls: 1,
              promptTokens: 100,
              outputTokens: 20,
              totalDurationNs: 5_000_000_000,
              loadDurationNs: 100_000_000,
              promptEvalDurationNs: 500_000_000,
              evalDurationNs: 2_500_000_000,
            },
            aardvark: {
              calls: 1,
              promptTokens: 100,
              outputTokens: 20,
              totalDurationNs: 5_000_000_000,
              loadDurationNs: 100_000_000,
              promptEvalDurationNs: 500_000_000,
              evalDurationNs: 2_500_000_000,
            },
          },
          lastCall: {
            model: 'zebra',
            promptTokens: 100,
            outputTokens: 20,
            totalDurationNs: 5_000_000_000,
            loadDurationNs: 100_000_000,
            promptEvalDurationNs: 500_000_000,
            evalDurationNs: 2_500_000_000,
          },
        }}
      />,
    );

    const frame = lastFrame() ?? '';
    const aardvarkIndex = frame.indexOf('aardvark');
    const zebraModelIndex = frame.indexOf('zebra:');

    expect(aardvarkIndex).toBeGreaterThan(0);
    expect(zebraModelIndex).toBeGreaterThan(0);
    expect(aardvarkIndex).toBeLessThan(zebraModelIndex);
  });
});
