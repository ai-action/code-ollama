import { sortFilePaths } from './discovery';

describe('sortFilePaths', () => {
  it('sorts non-dot files before dot files', () => {
    expect(sortFilePaths('README.md', '.env')).toBe(-1);
    expect(sortFilePaths('.env', 'README.md')).toBe(1);
  });

  it('sorts files alphabetically within the same group', () => {
    expect(sortFilePaths('b.ts', 'a.ts')).toBeGreaterThan(0);
    expect(sortFilePaths('a.ts', 'b.ts')).toBeLessThan(0);
    expect(sortFilePaths('.b', '.a')).toBeGreaterThan(0);
    expect(sortFilePaths('.a', '.b')).toBeLessThan(0);
  });

  it('returns zero for identical paths', () => {
    expect(sortFilePaths('same.ts', 'same.ts')).toBe(0);
  });
});
