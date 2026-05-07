import { Text } from 'ink';
import { render } from 'ink-testing-library';

interface MockSelectPromptProps {
  highlightText: string;
  onChange: (value: string) => void;
  options: { label: string; value: string }[];
}

const { mockSelectPrompt } = vi.hoisted(() => ({
  mockSelectPrompt: vi.fn<(props: MockSelectPromptProps) => void>(),
}));

vi.mock('../SelectPrompt', () => ({
  SelectPrompt: (props: MockSelectPromptProps) => {
    mockSelectPrompt(props);
    return (
      <>
        {props.options.map(({ label, value }) => (
          <Text key={value}>{label}</Text>
        ))}
      </>
    );
  },
}));

import { CommandMenu } from './CommandMenu';

describe('CommandMenu', () => {
  beforeEach(() => {
    mockSelectPrompt.mockReset();
  });

  it('returns null when input does not start with a slash', () => {
    const onSubmit = vi.fn();
    const { lastFrame } = render(
      <CommandMenu input="hello" onSubmit={onSubmit} />,
    );

    expect(lastFrame()).toBe('');
    expect(mockSelectPrompt).not.toHaveBeenCalled();
  });

  it('returns null when no commands match the slash input', () => {
    const onSubmit = vi.fn();
    const { lastFrame } = render(
      <CommandMenu input="/x" onSubmit={onSubmit} />,
    );

    expect(lastFrame()).toBe('');
    expect(mockSelectPrompt).not.toHaveBeenCalled();
  });

  it('renders matching commands and forwards selection', () => {
    const onSubmit = vi.fn();
    const { lastFrame } = render(
      <CommandMenu input="/m" onSubmit={onSubmit} />,
    );

    expect(lastFrame()).toContain('/model - switch the model');
    expect(lastFrame()).not.toContain('/clear - clear the current session');
    expect(mockSelectPrompt).toHaveBeenCalledTimes(1);

    const [firstCall] = mockSelectPrompt.mock.calls;
    expect(firstCall).toBeDefined();
    const [props] = firstCall;
    expect(props.highlightText).toBe('/m');
    expect(props.options).toEqual([
      {
        label: '/model - switch the model',
        value: '/model',
      },
    ]);
    const { onChange } = props;
    onChange('/model');
    expect(onSubmit).toHaveBeenCalledWith('/model');
  });
});
