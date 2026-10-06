import { Text, useStdout } from 'ink';
import { render } from 'ink-testing-library';

import { useTerminalColumns } from './useTerminalColumns';

const { mockStdout } = vi.hoisted(() => ({
  mockStdout: { columns: undefined as number | undefined },
}));

vi.mock('ink', async () => ({
  ...(await vi.importActual('ink')),
  useStdout: vi.fn(() => ({ stdout: mockStdout })),
}));

function Columns() {
  return <Text>{useTerminalColumns()}</Text>;
}

function renderColumns(): string {
  return render(<Columns />).lastFrame() ?? '';
}

describe('useTerminalColumns', () => {
  beforeEach(() => {
    vi.mocked(useStdout).mockClear();
  });

  it('returns the reported terminal width', () => {
    mockStdout.columns = 120;
    expect(renderColumns()).toBe('120');
  });

  it('falls back to 80 columns when the width is missing', () => {
    mockStdout.columns = undefined;
    expect(renderColumns()).toBe('80');
  });

  it('falls back to 80 columns when the width is zero', () => {
    mockStdout.columns = 0;
    expect(renderColumns()).toBe('80');
  });
});
