import { render } from 'ink-testing-library';

import { ROLE, THEME } from '@/constants';

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
    const { lastFrame } = render(
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
    const { lastFrame } = render(
      <CodeBlock code="plain text" role={ROLE.ASSISTANT} />,
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('plain text');
  });

  it('renders with system role styling', () => {
    const { lastFrame } = render(
      <CodeBlock code="system code" language="bash" role={ROLE.SYSTEM} />,
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('system code');
  });

  it('handles component unmount (cleanup)', () => {
    const { unmount, lastFrame } = render(
      <CodeBlock code="test" language="ts" role={ROLE.ASSISTANT} />,
    );
    expect(lastFrame()).toContain('test');
    // Unmount should trigger cleanup without errors
    unmount();
  });

  it('prewarmHighlight populates the cache', async () => {
    await prewarmHighlight('let y = 2;', 'ts');
    const { lastFrame } = render(
      <CodeBlock code="let y = 2;" language="ts" role={ROLE.ASSISTANT} />,
    );
    expect(lastFrame()).toContain('let y = 2;');
  });

  it('prewarmCodeBlocks prewarms all code blocks in content', async () => {
    const content = 'Here:\n```ts\nconst a = 1;\n```';
    await prewarmCodeBlocks(content);
    const { lastFrame } = render(
      <CodeBlock code="const a = 1;" language="ts" role={ROLE.ASSISTANT} />,
    );
    expect(lastFrame()).toContain('const a = 1;');
  });

  it('prewarmCodeBlocks is a no-op for content without code blocks', async () => {
    await expect(prewarmCodeBlocks('no code here')).resolves.toBeUndefined();
  });

  it('passes the selected theme to Shiki', () => {
    render(
      <CodeBlock
        code="const z = 3;"
        language="ts"
        role={ROLE.ASSISTANT}
        theme={THEME.getTheme('solarized-dark')}
      />,
    );

    return new Promise((resolve) => setTimeout(resolve, 0)).then(() => {
      expect(codeToANSI).toHaveBeenCalledWith(
        'const z = 3;',
        'ts',
        'solarized-dark',
      );
    });
  });

  it('renders highlighted code immediately from cache on re-mount', async () => {
    const { unmount } = render(
      <CodeBlock code="cached" language="ts" role={ROLE.ASSISTANT} />,
    );
    // Allow async highlight to resolve and populate cache
    await new Promise((r) => setTimeout(r, 0));
    unmount();

    // Re-mount: cache hit should provide highlighted value synchronously
    const { lastFrame } = render(
      <CodeBlock code="cached" language="ts" role={ROLE.ASSISTANT} />,
    );
    expect(lastFrame()).toContain('cached');
  });
});
