import { render } from 'ink-testing-library';

import { ROLE, THEME } from '@/constants';
import { time } from '@/utils';
import { renderWithTheme } from '@/utils/testing';

import { CodeBlock, prewarmCodeBlocks, prewarmHighlight } from './CodeBlock';

const { codeToANSI } = vi.hoisted(() => ({
  codeToANSI: vi.fn((code: string) => Promise.resolve(code)),
}));

vi.mock('@shikijs/cli', () => ({
  codeToANSI,
}));

describe('CodeBlock', () => {
  beforeEach(() => {
    codeToANSI.mockClear();
  });

  it('renders code with syntax highlighting', () => {
    const { lastFrame } = renderWithTheme(
      <CodeBlock
        code="const x = 1;"
        language="typescript"
        role={ROLE.ASSISTANT}
      />,
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('const x = 1;');
  });

  it('renders code without language', () => {
    const { lastFrame } = renderWithTheme(
      <CodeBlock code="plain text" role={ROLE.ASSISTANT} />,
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('plain text');
  });

  it('renders with system role styling', () => {
    const { lastFrame } = renderWithTheme(
      <CodeBlock code="system code" language="bash" role={ROLE.SYSTEM} />,
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('system code');
  });

  it('handles component unmount (cleanup)', () => {
    const { unmount, lastFrame } = renderWithTheme(
      <CodeBlock code="test" language="ts" role={ROLE.ASSISTANT} />,
    );
    expect(lastFrame()).toContain('test');
    // Unmount should trigger cleanup without errors
    unmount();
  });

  it('prewarmHighlight populates the cache', async () => {
    await prewarmHighlight('let y = 2;', 'ts');
    const { lastFrame } = renderWithTheme(
      <CodeBlock code="let y = 2;" language="ts" role={ROLE.ASSISTANT} />,
    );
    expect(lastFrame()).toContain('let y = 2;');
  });

  it('prewarmCodeBlocks prewarms all code blocks in content', async () => {
    const content = 'Here:\n```ts\nconst a = 1;\n```';
    await prewarmCodeBlocks(content);
    const { lastFrame } = renderWithTheme(
      <CodeBlock code="const a = 1;" language="ts" role={ROLE.ASSISTANT} />,
    );
    expect(lastFrame()).toContain('const a = 1;');
  });

  it('prewarmCodeBlocks is a no-op for content without code blocks', async () => {
    await expect(prewarmCodeBlocks('no code here')).resolves.toBeUndefined();
  });

  it('passes the selected theme to Shiki', async () => {
    renderWithTheme(
      <CodeBlock
        code="const z = 3;"
        language="ts"
        role={ROLE.ASSISTANT}
        theme={THEME.getTheme('solarized-dark')}
      />,
    );

    await time.tick();
    expect(codeToANSI).toHaveBeenCalledWith(
      'const z = 3;',
      'ts',
      'solarized-dark',
    );
  });

  it('uses theme prop when rendered outside ThemeProvider', async () => {
    render(
      <CodeBlock
        code="const x = 1;"
        language="ts"
        role={ROLE.ASSISTANT}
        theme={THEME.getTheme('github-light')}
      />,
    );

    await time.tick();
    expect(codeToANSI).toHaveBeenCalledWith(
      'const x = 1;',
      'ts',
      'github-light',
    );
  });

  it('renders highlighted code immediately from cache on re-mount', async () => {
    const { unmount } = renderWithTheme(
      <CodeBlock code="cached" language="ts" role={ROLE.ASSISTANT} />,
    );
    // Allow async highlight to resolve and populate cache
    await time.tick();
    unmount();

    // Re-mount: cache hit should provide highlighted value synchronously
    const { lastFrame } = renderWithTheme(
      <CodeBlock code="cached" language="ts" role={ROLE.ASSISTANT} />,
    );
    expect(lastFrame()).toContain('cached');
  });

  it('renders diff with system role styling', () => {
    const { lastFrame } = renderWithTheme(
      <CodeBlock
        code="+ added line\n- removed line"
        language="diff"
        role={ROLE.SYSTEM}
      />,
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('added line');
    expect(frame).toContain('removed line');
  });

  it('renders diff with @@ hunk headers', () => {
    const { lastFrame } = renderWithTheme(
      <CodeBlock
        code="@@ -1,3 +1,4 @@\n context\n+added"
        language="diff"
        role={ROLE.ASSISTANT}
      />,
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('@@');
    expect(frame).toContain('added');
  });

  it('renders diff with file headers and empty lines', () => {
    const { lastFrame } = renderWithTheme(
      <CodeBlock
        code="--- a/file.txt\n+++ b/file.txt\n@@ -1,2 +1,2 @@\n line1\n+added\n\n"
        language="diff"
        role={ROLE.ASSISTANT}
      />,
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('--- a/file.txt');
    expect(frame).toContain('+++ b/file.txt');
  });

  it('renders new file diff with +++ header only', () => {
    const { lastFrame } = renderWithTheme(
      <CodeBlock
        code="+++ new/file.txt\n@@ -0,0 +1 @@\n+new content"
        language="diff"
        role={ROLE.ASSISTANT}
      />,
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('+++ new/file.txt');
    expect(frame).toContain('new content');
  });

  it('renders diff with empty line in middle', () => {
    const { lastFrame } = renderWithTheme(
      <CodeBlock
        code="@@ -1,3 +1,3 @@\n line1\n\n line3"
        language="diff"
        role={ROLE.ASSISTANT}
      />,
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('line1');
    expect(frame).toContain('line3');
  });

  it('renders diff with context line (space prefix)', () => {
    const { lastFrame } = renderWithTheme(
      <CodeBlock code=" context line" language="diff" role={ROLE.ASSISTANT} />,
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('context line');
  });

  it('renders diff with only empty lines', () => {
    const { lastFrame } = renderWithTheme(
      <CodeBlock code="\n" language="diff" role={ROLE.ASSISTANT} />,
    );
    const frame = lastFrame() ?? '';
    expect(frame).toBeTruthy();
  });
});
