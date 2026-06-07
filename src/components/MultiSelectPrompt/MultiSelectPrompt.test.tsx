import { Text } from 'ink';

import { renderWithTheme } from '@/utils/testing';

import { MultiSelectPrompt } from './MultiSelectPrompt';

const inputHandlers: ((
  input: string,
  key: { ctrl?: boolean; escape?: boolean },
) => void)[] = [];

const mockTimeTick = vi.hoisted(() => vi.fn(() => Promise.resolve()));

vi.mock('ink', async () => ({
  ...(await vi.importActual('ink')),
  useInput: (
    handler: (input: string, key: { ctrl?: boolean; escape?: boolean }) => void,
  ) => {
    inputHandlers.push(handler);
  },
}));

vi.mock('@/utils', async () => {
  const actual = await vi.importActual<typeof import('@/utils')>('@/utils');
  return {
    ...actual,
    time: {
      ...actual.time,
      tick: mockTimeTick,
    },
  };
});

const mockMultiSelect = vi.hoisted(() =>
  vi.fn<
    (props: {
      options: { label: string; value: string }[];
      defaultValue?: string[];
      onSubmit?: (values: string[]) => void;
      isDisabled?: boolean;
    }) => void
  >(),
);

vi.mock('@inkjs/ui', async () => {
  const { Text } = await import('ink');
  return {
    MultiSelect: (props: {
      options: { label: string; value: string }[];
      defaultValue?: string[];
      onSubmit?: (values: string[]) => void;
      isDisabled?: boolean;
    }) => {
      mockMultiSelect(props);
      return <Text>MultiSelect</Text>;
    },
  };
});

describe('MultiSelectPrompt', () => {
  beforeEach(() => {
    inputHandlers.length = 0;
    mockMultiSelect.mockClear();
    mockTimeTick.mockClear();
  });

  it('renders children and MultiSelect', async () => {
    mockTimeTick.mockResolvedValue(undefined);
    const { lastFrame } = renderWithTheme(
      <MultiSelectPrompt options={[]}>
        <Text>Child content</Text>
      </MultiSelectPrompt>,
    );

    // Wait for useEffect to set isInteractive
    await mockTimeTick();

    expect(lastFrame()).toContain('Child content');
    expect(lastFrame()).toContain('MultiSelect');
  });

  it('calls onCancel when escape is pressed', async () => {
    mockTimeTick.mockResolvedValue(undefined);
    const onCancel = vi.fn();
    renderWithTheme(<MultiSelectPrompt options={[]} onCancel={onCancel} />);

    await mockTimeTick();

    const inputHandler = inputHandlers.at(-1);
    expect(inputHandler).toBeDefined();
    inputHandler?.('', { escape: true });

    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('calls onCancel when ctrl+c is pressed', async () => {
    mockTimeTick.mockResolvedValue(undefined);
    const onCancel = vi.fn();
    renderWithTheme(<MultiSelectPrompt options={[]} onCancel={onCancel} />);

    await mockTimeTick();

    const inputHandler = inputHandlers.at(-1);
    expect(inputHandler).toBeDefined();
    inputHandler?.('c', { ctrl: true });

    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('does not call onCancel when other keys are pressed', async () => {
    mockTimeTick.mockResolvedValue(undefined);
    const onCancel = vi.fn();
    renderWithTheme(<MultiSelectPrompt options={[]} onCancel={onCancel} />);

    await mockTimeTick();

    const inputHandler = inputHandlers.at(-1);
    expect(inputHandler).toBeDefined();
    inputHandler?.('a', {});

    expect(onCancel).not.toHaveBeenCalled();
  });

  it('disables MultiSelect initially and enables after tick', async () => {
    mockTimeTick.mockResolvedValue(undefined);
    renderWithTheme(<MultiSelectPrompt options={[]} />);

    // First render should be disabled
    expect(mockMultiSelect).toHaveBeenCalled();
    expect(mockMultiSelect.mock.calls[0]?.[0].isDisabled).toBe(true);

    // After tick, should be enabled
    await vi.waitFor(() => {
      expect(mockMultiSelect.mock.calls.at(-1)?.[0].isDisabled).toBe(false);
    });
  });

  it('respects isDisabled prop', async () => {
    mockTimeTick.mockResolvedValue(undefined);
    renderWithTheme(<MultiSelectPrompt options={[]} isDisabled />);

    await mockTimeTick();

    expect(mockMultiSelect.mock.calls.at(-1)?.[0].isDisabled).toBe(true);
  });

  it('passes options and callbacks to MultiSelect', async () => {
    mockTimeTick.mockResolvedValue(undefined);
    const options = [
      { label: 'Option 1', value: '1' },
      { label: 'Option 2', value: '2' },
    ];
    const onSubmit = vi.fn();
    const defaultValue = ['1'];

    renderWithTheme(
      <MultiSelectPrompt
        options={options}
        defaultValue={defaultValue}
        onSubmit={onSubmit}
      />,
    );

    await vi.waitFor(() => {
      const lastCall = mockMultiSelect.mock.calls.at(-1)?.[0];
      expect(lastCall?.options).toEqual(options);
      expect(lastCall?.defaultValue).toEqual(defaultValue);
      expect(lastCall?.onSubmit).toBe(onSubmit);
      expect(lastCall?.isDisabled).toBe(false);
    });
  });
});
