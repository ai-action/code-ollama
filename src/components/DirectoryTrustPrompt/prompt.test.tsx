const { render, reset } = vi.hoisted(() => ({
  render: vi.fn(),
  reset: vi.fn(),
}));

vi.mock('ink', async () => ({
  ...(await vi.importActual('ink')),
  render,
}));

vi.mock('@/utils/screen', () => ({
  reset,
}));

import { INK } from '@/constants';

import { promptForDirectoryTrust } from './prompt';

interface DirectoryTrustPromptProps {
  directory: string;
  onDecision: (isTrusted: boolean) => void;
}

function getPromptProps() {
  const wrapper = render.mock.calls[0][0] as {
    props: { children: React.ReactElement<DirectoryTrustPromptProps> };
  };
  // The component is now wrapped in ThemeProvider, get the child
  const element = wrapper.props.children;

  return element.props;
}

describe('promptForDirectoryTrust', () => {
  const unmount = vi.fn();
  const waitUntilExit = vi.fn<() => Promise<void>>();

  beforeEach(() => {
    reset.mockClear();
    unmount.mockClear();
    waitUntilExit.mockResolvedValue();
    render.mockReturnValue({ unmount, waitUntilExit });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns true when the trust prompt is accepted', async () => {
    const result = promptForDirectoryTrust('/resolved/project');

    getPromptProps().onDecision(true);

    await expect(result).resolves.toBe(true);
    expect(render).toHaveBeenCalledWith(expect.anything(), INK.RENDER_OPTIONS);
    expect(reset).toHaveBeenCalledOnce();
    expect(reset).toHaveBeenCalledBefore(render);
    expect(getPromptProps().directory).toBe('/resolved/project');
    expect(unmount).toHaveBeenCalledOnce();
  });

  it('returns false when the trust prompt is rejected', async () => {
    const result = promptForDirectoryTrust('/resolved/project');

    getPromptProps().onDecision(false);

    await expect(result).resolves.toBe(false);
    expect(unmount).toHaveBeenCalledOnce();
  });

  it('returns false when the prompt exits without a decision', async () => {
    await expect(promptForDirectoryTrust('/resolved/project')).resolves.toBe(
      false,
    );
  });
});
