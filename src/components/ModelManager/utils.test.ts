import {
  buildDownloadOptions,
  buildInstalledModelOptions,
  buildMenuOptions,
  formatBytes,
  getNoticeColor,
  isAbortError,
  mergeDownloadProgress,
} from './utils';

describe('formatBytes', () => {
  it('returns "0 B" for negative values', () => {
    expect(formatBytes(-1)).toBe('0 B');
  });

  it('returns "0 B" for zero', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('returns "0 B" for Infinity', () => {
    expect(formatBytes(Infinity)).toBe('0 B');
  });

  it('returns "0 B" for NaN', () => {
    expect(formatBytes(NaN)).toBe('0 B');
  });

  it('formats bytes without decimal for values >= 10 in a unit', () => {
    expect(formatBytes(10)).toBe('10 B');
    expect(formatBytes(1024 * 10)).toBe('10 KB');
  });

  it('formats bytes with one decimal for values < 10 in a unit', () => {
    expect(formatBytes(1024 * 5)).toBe('5.0 KB');
  });

  it('formats TB for very large values', () => {
    expect(formatBytes(1024 ** 4)).toBe('1.0 TB');
  });
});

describe('buildMenuOptions', () => {
  it('returns the four menu options', () => {
    const options = buildMenuOptions();
    expect(options.map((o) => o.label)).toEqual([
      'Switch model',
      'Download model',
      'Delete model',
      'Cancel',
    ]);
  });
});

describe('buildInstalledModelOptions', () => {
  it('puts the current model first', () => {
    const options = buildInstalledModelOptions(['llama3', 'gemma4'], 'gemma4');
    expect(options[0].value).toBe('gemma4');
  });

  it('appends "(current model)" to the current model label', () => {
    const options = buildInstalledModelOptions(['gemma4'], 'gemma4');
    expect(options[0].label).toContain('(current model)');
  });

  it('does not append note when current model is not in list', () => {
    const options = buildInstalledModelOptions(['llama3'], 'gemma4');
    expect(options[0].label).toBe('llama3');
  });
});

describe('buildDownloadOptions', () => {
  it('starts with custom option and ends with back', () => {
    const options = buildDownloadOptions([]);
    expect(options[0].value).toBe('custom');
    expect(options.at(-1)?.value).toBe('back');
  });

  it('filters entries whose exact value or alias is already installed', () => {
    const options = buildDownloadOptions(['qwen2.5-coder:7b', 'granite4.1:8b']);

    expect(options.map((option) => option.label)).not.toContain(
      'Qwen 2.5 Coder (qwen2.5-coder:latest)',
    );
    expect(options.map((option) => option.label)).not.toContain(
      'Granite 4 (granite4.1:8b)',
    );
  });
});

describe('getNoticeColor', () => {
  const theme = {
    colors: { error: 'red', status: 'green', secondary: 'gray' },
  } as Parameters<typeof getNoticeColor>[1];

  it('returns error color for error tone', () => {
    expect(getNoticeColor('error', theme)).toBe('red');
  });

  it('returns status color for success tone', () => {
    expect(getNoticeColor('success', theme)).toBe('green');
  });

  it('returns secondary color for info tone', () => {
    expect(getNoticeColor('info', theme)).toBe('gray');
  });
});

describe('isAbortError', () => {
  it('returns true for an AbortError', () => {
    const err = new DOMException('aborted', 'AbortError');
    expect(isAbortError(err)).toBe(true);
  });

  it('returns false for a generic error', () => {
    expect(isAbortError(new Error('fail'))).toBe(false);
  });

  it('returns false for non-Error values', () => {
    expect(isAbortError('string')).toBe(false);
    expect(isAbortError(null)).toBe(false);
  });
});

describe('mergeDownloadProgress', () => {
  it('returns new progress when both completed and total are valid', () => {
    const result = mergeDownloadProgress(null, 'model', 'downloading', 50, 100);
    expect(result).toEqual({
      model: 'model',
      status: 'downloading',
      completed: 50,
      total: 100,
    });
  });

  it('falls back to zero progress when previous is null and totals are invalid', () => {
    const result = mergeDownloadProgress(
      null,
      'model',
      'verifying',
      null,
      null,
    );
    expect(result).toEqual({
      model: 'model',
      status: 'verifying',
      completed: 0,
      total: 0,
    });
  });

  it('carries previous progress when model matches and new values are invalid', () => {
    const previous = {
      model: 'model',
      status: 'downloading',
      completed: 80,
      total: 100,
    };
    const result = mergeDownloadProgress(
      previous,
      'model',
      'verifying',
      undefined,
      undefined,
    );
    expect(result).toEqual({
      model: 'model',
      status: 'verifying',
      completed: 80,
      total: 100,
    });
  });

  it('does not carry previous progress when model name differs', () => {
    const previous = {
      model: 'other',
      status: 'downloading',
      completed: 80,
      total: 100,
    };
    const result = mergeDownloadProgress(
      previous,
      'model',
      'verifying',
      undefined,
      undefined,
    );
    expect(result).toEqual({
      model: 'model',
      status: 'verifying',
      completed: 0,
      total: 0,
    });
  });
});
