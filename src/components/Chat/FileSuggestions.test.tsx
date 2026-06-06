import type { Dirent } from 'node:fs';

import { KEY } from '@/constants';
import { time } from '@/utils';
import { execFile } from '@/utils/node';
import { renderWithTheme } from '@/utils/testing';

vi.mock('@/utils/node', () => ({
  execFile: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  readdir: vi.fn(),
  readFile: vi.fn(),
}));

import { buildNextInput, FileSuggestions } from './FileSuggestions';

function createDirent(
  name: string,
  type: 'directory' | 'file' | 'other',
): Dirent {
  return {
    name,
    isBlockDevice: () => false,
    isCharacterDevice: () => false,
    isDirectory: () => type === 'directory',
    isFIFO: () => false,
    isFile: () => type === 'file',
    isSocket: () => false,
    isSymbolicLink: () => false,
  } as Dirent;
}

function mockRipgrepSuccess(stdout: string) {
  vi.mocked(execFile).mockResolvedValue({ stdout, stderr: '' });
}

function mockRipgrepFailure() {
  vi.mocked(execFile).mockRejectedValue(new Error('rg missing'));
}

describe('FileSuggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads file suggestions with ripgrep', async () => {
    mockRipgrepSuccess('src/app.ts\nsrc/utils/tools.ts\nREADME.md\n');

    const { lastFrame } = renderWithTheme(
      <FileSuggestions input="@src" onSelect={vi.fn()} />,
    );

    await time.tick(20);

    expect(lastFrame()).toContain('src/app.ts');
    expect(lastFrame()).toContain('src/utils/tools.ts');
    expect(lastFrame()).not.toContain('README.md');
  });

  it('falls back to Node.js traversal when ripgrep fails', async () => {
    const { readdir } = await import('node:fs/promises');
    mockRipgrepFailure();

    vi.mocked(readdir).mockImplementation((path) => {
      const currentPath = String(path);

      if (currentPath.endsWith('/src')) {
        return Promise.resolve([
          createDirent('feature.ts', 'file'),
        ] as unknown as ReturnType<typeof readdir>);
      }

      if (currentPath.endsWith('/.github')) {
        return Promise.resolve([
          createDirent('workflows', 'directory'),
        ] as unknown as ReturnType<typeof readdir>);
      }

      if (currentPath.endsWith('/workflows')) {
        return Promise.resolve([
          createDirent('test.yml', 'file'),
        ] as unknown as ReturnType<typeof readdir>);
      }

      return Promise.resolve([
        createDirent('.git', 'directory'),
        createDirent('.github', 'directory'),
        createDirent('src', 'directory'),
        createDirent('.gitignore', 'file'),
        createDirent('socket', 'other'),
      ] as unknown as ReturnType<typeof readdir>);
    });

    const { lastFrame } = renderWithTheme(
      <FileSuggestions input="@git" onSelect={vi.fn()} />,
    );

    await time.tick(20);

    expect(lastFrame()).toContain('.gitignore');
    expect(lastFrame()).not.toContain('.git/');
    expect(lastFrame()).not.toContain('HEAD');
  });

  it('builds the next input for a selected file', () => {
    expect(buildNextInput('read @src', 'src/components/Input.tsx')).toEqual({
      value: 'read src/components/Input.tsx ',
      cursorPosition: 30,
    });
  });

  it('reports the active suggestion and clears it when no options remain', async () => {
    mockRipgrepSuccess('src/components/App.tsx\nsrc/utils/tools.ts\n');

    const onChange = vi.fn();
    const { stdin, rerender } = renderWithTheme(
      <FileSuggestions input="hello" onChange={onChange} onSelect={vi.fn()} />,
    );

    await time.tick(20);
    expect(onChange).toHaveBeenLastCalledWith(null);

    rerender(
      <FileSuggestions input="@src" onChange={onChange} onSelect={vi.fn()} />,
    );
    await time.tick();
    expect(onChange).toHaveBeenLastCalledWith('src/components/App.tsx ');

    stdin.write(KEY.DOWN);
    await time.tick();
    expect(onChange).toHaveBeenLastCalledWith('src/utils/tools.ts ');

    rerender(
      <FileSuggestions
        input="@missing"
        onChange={onChange}
        onSelect={vi.fn()}
      />,
    );
    await time.tick();
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('ignores keyboard interactions when disabled', async () => {
    mockRipgrepSuccess('src/components/App.tsx\nsrc/utils/tools.ts\n');

    const onSelect = vi.fn();
    const { stdin } = renderWithTheme(
      <FileSuggestions input="@src" isDisabled onSelect={onSelect} />,
    );

    await time.tick(20);
    stdin.write(KEY.TAB);
    await time.tick();

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('ignores non-navigation key presses when suggestions are visible', async () => {
    mockRipgrepSuccess('src/components/App.tsx\nsrc/utils/tools.ts\n');

    const onSelect = vi.fn();
    const { stdin } = renderWithTheme(
      <FileSuggestions input="@src" onSelect={onSelect} />,
    );

    await time.tick(20);
    stdin.write('x');
    await time.tick();

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('ignores non-mention input and keeps the first option focused on Up', async () => {
    mockRipgrepSuccess('src/components/App.tsx\nsrc/utils/tools.ts\n');

    const onSelect = vi.fn();
    const { lastFrame, stdin, rerender } = renderWithTheme(
      <FileSuggestions input="hello" onSelect={onSelect} />,
    );

    await time.tick(20);

    expect(lastFrame()).toBe('');

    rerender(<FileSuggestions input="@src" onSelect={onSelect} />);
    await time.tick(20);
    stdin.write(KEY.UP);
    await time.tick();
    stdin.write(KEY.TAB);
    await time.tick();

    expect(onSelect).toHaveBeenCalledWith({
      value: 'src/components/App.tsx ',
      cursorPosition: 23,
    });
  });

  it('shows at most five visible options', async () => {
    mockRipgrepSuccess(
      'src/1.ts\nsrc/2.ts\nsrc/3.ts\nsrc/4.ts\nsrc/5.ts\nsrc/6.ts\n',
    );

    const { lastFrame } = renderWithTheme(
      <FileSuggestions input="@src" onSelect={vi.fn()} />,
    );

    await time.tick(20);

    const frame = lastFrame() ?? '';
    expect(frame).toContain('src/1.ts');
    expect(frame).toContain('src/5.ts');
    expect(frame).not.toContain('src/6.ts');
  });

  it('preserves trailing text without adding extra space when suffix starts with whitespace', () => {
    expect(buildNextInput('see @app hello', 'src/components/App.tsx')).toEqual({
      value: 'see src/components/App.tsx hello',
      cursorPosition: 26,
    });
  });
});
