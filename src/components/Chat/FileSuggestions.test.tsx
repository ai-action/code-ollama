import { exec } from 'node:child_process';
import type { Dirent } from 'node:fs';
import { readdirSync } from 'node:fs';

import { render } from 'ink-testing-library';

import { KEY } from '../../constants';
import { tick } from '../../utils/test';

vi.mock('node:child_process', () => ({
  exec: vi.fn(),
}));

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...actual,
    readdirSync: vi.fn(),
  };
});

import { FileSuggestions } from './FileSuggestions';

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

describe('FileSuggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads file suggestions with ripgrep', async () => {
    vi.mocked(exec).mockImplementation((_command, _options, callback) => {
      callback?.(null, 'src/app.ts\nsrc/utils/tools.ts\nREADME.md\n', '');
      return {} as ReturnType<typeof exec>;
    });

    const { lastFrame } = render(
      <FileSuggestions input="@src" onSelect={vi.fn()} />,
    );

    await tick(20);

    expect(lastFrame()).toContain('src/app.ts');
    expect(lastFrame()).toContain('src/utils/tools.ts');
    expect(lastFrame()).not.toContain('README.md');
  });

  it('falls back to Node.js traversal when ripgrep fails', async () => {
    vi.mocked(exec).mockImplementation((_command, _options, callback) => {
      callback?.(new Error('rg missing'), '', '');
      return {} as ReturnType<typeof exec>;
    });

    vi.mocked(readdirSync).mockImplementation((path) => {
      const currentPath = String(path);

      if (currentPath.endsWith('/src')) {
        return [createDirent('feature.ts', 'file')] as unknown as ReturnType<
          typeof readdirSync
        >;
      }

      if (currentPath.endsWith('/.github')) {
        return [
          createDirent('workflows', 'directory'),
        ] as unknown as ReturnType<typeof readdirSync>;
      }

      if (currentPath.endsWith('/workflows')) {
        return [createDirent('test.yml', 'file')] as unknown as ReturnType<
          typeof readdirSync
        >;
      }

      return [
        createDirent('.git', 'directory'),
        createDirent('.github', 'directory'),
        createDirent('src', 'directory'),
        createDirent('.gitignore', 'file'),
        createDirent('socket', 'other'),
      ] as unknown as ReturnType<typeof readdirSync>;
    });

    const { lastFrame } = render(
      <FileSuggestions input="@git" onSelect={vi.fn()} />,
    );

    await tick(20);

    expect(lastFrame()).toContain('.gitignore');
    expect(lastFrame()).not.toContain('.git/');
    expect(lastFrame()).not.toContain('HEAD');
  });

  it('selects the focused file on Tab', async () => {
    vi.mocked(exec).mockImplementation((_command, _options, callback) => {
      callback?.(
        null,
        'src/components/App.tsx\nsrc/utils/tools.ts\nsrc/components/Input.tsx\n',
        '',
      );
      return {} as ReturnType<typeof exec>;
    });

    const onSelect = vi.fn();
    const { stdin } = render(
      <FileSuggestions input="read @src" onSelect={onSelect} />,
    );

    await tick(20);
    stdin.write(KEY.DOWN);
    await tick();
    stdin.write(KEY.TAB);
    await tick();

    expect(onSelect).toHaveBeenCalledWith('read src/components/Input.tsx ');
  });

  it('ignores keyboard interactions when disabled', async () => {
    vi.mocked(exec).mockImplementation((_command, _options, callback) => {
      callback?.(null, 'src/components/App.tsx\nsrc/utils/tools.ts\n', '');
      return {} as ReturnType<typeof exec>;
    });

    const onSelect = vi.fn();
    const { stdin } = render(
      <FileSuggestions input="@src" isDisabled onSelect={onSelect} />,
    );

    await tick(20);
    stdin.write(KEY.TAB);
    await tick();

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('ignores non-navigation key presses when suggestions are visible', async () => {
    vi.mocked(exec).mockImplementation((_command, _options, callback) => {
      callback?.(null, 'src/components/App.tsx\nsrc/utils/tools.ts\n', '');
      return {} as ReturnType<typeof exec>;
    });

    const onSelect = vi.fn();
    const { stdin } = render(
      <FileSuggestions input="@src" onSelect={onSelect} />,
    );

    await tick(20);
    stdin.write('x');
    await tick();

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('does not update state after unmounting before file load completes', async () => {
    let callback:
      | ((error: Error | null, stdout: string, stderr: string) => void)
      | undefined;

    vi.mocked(exec).mockImplementation((_command, _options, nextCallback) => {
      callback = nextCallback;
      return {} as ReturnType<typeof exec>;
    });

    const { unmount } = render(
      <FileSuggestions input="@src" onSelect={vi.fn()} />,
    );

    await tick();
    unmount();

    callback?.(null, 'src/components/App.tsx\n', '');
    await tick();
  });

  it('ignores non-mention input and keeps the first option focused on Up', async () => {
    vi.mocked(exec).mockImplementation((_command, _options, callback) => {
      callback?.(null, 'src/components/App.tsx\nsrc/utils/tools.ts\n', '');
      return {} as ReturnType<typeof exec>;
    });

    const onSelect = vi.fn();
    const { lastFrame, stdin, rerender } = render(
      <FileSuggestions input="hello" onSelect={onSelect} />,
    );

    await tick(20);

    expect(lastFrame()).toBe('');

    rerender(<FileSuggestions input="@src" onSelect={onSelect} />);
    await tick(20);
    stdin.write(KEY.UP);
    await tick();
    stdin.write(KEY.TAB);
    await tick();

    expect(onSelect).toHaveBeenCalledWith('src/components/App.tsx ');
  });

  it('shows at most five visible options', async () => {
    vi.mocked(exec).mockImplementation((_command, _options, callback) => {
      callback?.(
        null,
        'src/1.ts\nsrc/2.ts\nsrc/3.ts\nsrc/4.ts\nsrc/5.ts\nsrc/6.ts\n',
        '',
      );
      return {} as ReturnType<typeof exec>;
    });

    const { lastFrame } = render(
      <FileSuggestions input="@src" onSelect={vi.fn()} />,
    );

    await tick(20);

    const frame = lastFrame() ?? '';
    expect(frame).toContain('src/1.ts');
    expect(frame).toContain('src/5.ts');
    expect(frame).not.toContain('src/6.ts');
  });
});
