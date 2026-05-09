import { render } from 'ink-testing-library';

import { ROLE } from '../../constants';
import { CodeBlock } from './CodeBlock';

vi.mock('@shikijs/cli', () => ({
  codeToANSI: (code: string) => Promise.resolve(code),
}));

describe('CodeBlock', () => {
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
