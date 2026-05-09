import { render } from 'ink-testing-library';

import { ROLE } from '../../constants';
import { CodeBlock } from './CodeBlock';

vi.mock('@shikijs/cli', () => ({
  codeToANSI: (code: string) => Promise.resolve(`highlighted:${code}`),
}));

describe('CodeBlock', () => {
  it('renders code with language tag', () => {
    const { lastFrame } = render(
      <CodeBlock
        code="const x = 1;"
        language="typescript"
        role={ROLE.ASSISTANT}
      />,
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('TYPESCRIPT');
    expect(frame).toContain('const x = 1;');
  });

  it('renders code without language (no label)', () => {
    const { lastFrame } = render(
      <CodeBlock code="plain text" role={ROLE.ASSISTANT} />,
    );
    const frame = lastFrame() ?? '';
    // When no language is provided, no label is shown
    expect(frame).not.toContain('CODE');
    expect(frame).toContain('plain text');
  });

  it('renders with system role styling', () => {
    const { lastFrame } = render(
      <CodeBlock code="system code" language="bash" role={ROLE.SYSTEM} />,
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('BASH');
    expect(frame).toContain('system code');
  });

  it('handles various language colors', () => {
    const { lastFrame: ts } = render(
      <CodeBlock code="x" language="typescript" role={ROLE.ASSISTANT} />,
    );
    expect(ts()).toContain('TYPESCRIPT');

    const { lastFrame: js } = render(
      <CodeBlock code="x" language="javascript" role={ROLE.ASSISTANT} />,
    );
    expect(js()).toContain('JAVASCRIPT');

    const { lastFrame: py } = render(
      <CodeBlock code="x" language="python" role={ROLE.ASSISTANT} />,
    );
    expect(py()).toContain('PYTHON');

    const { lastFrame: json } = render(
      <CodeBlock code='{"a":1}' language="json" role={ROLE.ASSISTANT} />,
    );
    expect(json()).toContain('JSON');

    // Test additional languages for coverage
    const { lastFrame: html } = render(
      <CodeBlock code="<div>" language="html" role={ROLE.ASSISTANT} />,
    );
    expect(html()).toContain('HTML');

    const { lastFrame: css } = render(
      <CodeBlock code=".class{}" language="css" role={ROLE.ASSISTANT} />,
    );
    expect(css()).toContain('CSS');

    const { lastFrame: md } = render(
      <CodeBlock code="# title" language="markdown" role={ROLE.ASSISTANT} />,
    );
    expect(md()).toContain('MARKDOWN');

    // Test default/unknown language color
    const { lastFrame: unknown } = render(
      <CodeBlock code="x" language="unknown" role={ROLE.ASSISTANT} />,
    );
    expect(unknown()).toContain('UNKNOWN');
  });

  it('handles component unmount (cleanup)', () => {
    const { unmount, lastFrame } = render(
      <CodeBlock code="test" language="ts" role={ROLE.ASSISTANT} />,
    );
    expect(lastFrame()).toContain('TS');
    // Unmount should trigger cleanup without errors
    unmount();
  });
});
