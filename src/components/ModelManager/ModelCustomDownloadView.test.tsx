import { Text } from 'ink';
import { render } from 'ink-testing-library';

import { THEME } from '@/constants';

import { getLastTextInputProps, type MockTextInputProps } from './test-utils';

const { mockModelSuggestions, mockTextInput } = vi.hoisted(() => ({
  mockModelSuggestions:
    vi.fn<
      (props: {
        input: string;
        onHighlight?: (value: string | null) => void;
        onSelect?: (value: string) => void;
      }) => void
    >(),
  mockTextInput: vi.fn<(props: MockTextInputProps) => void>(),
}));

vi.mock('../TextInput', () => ({
  TextInput: (props: MockTextInputProps) => {
    mockTextInput(props);
    return (
      <Text>
        {props.value === '' ? (props.placeholder ?? '') : props.value}
      </Text>
    );
  },
}));

vi.mock('./ModelSuggestions', () => ({
  ModelSuggestions: (props: {
    input: string;
    onHighlight?: (value: string | null) => void;
    onSelect?: (value: string) => void;
  }) => {
    mockModelSuggestions(props);
    return <Text>{`Suggestions:${props.input}`}</Text>;
  },
}));

import { ModelCustomDownloadView } from './ModelCustomDownloadView';

describe('ModelCustomDownloadView', () => {
  beforeEach(() => {
    mockModelSuggestions.mockReset();
    mockTextInput.mockReset();
  });

  it('renders the prompt, placeholder, and suggestions', () => {
    const { lastFrame } = render(
      <ModelCustomDownloadView
        downloadDraft=""
        notice={null}
        theme={THEME.getTheme()}
        onDraftChange={vi.fn()}
        onHighlight={vi.fn()}
        onSelectSuggestion={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(lastFrame()).toContain('Enter an Ollama model name to download.');
    expect(lastFrame()).toContain('name:tag');
    expect(lastFrame()).toContain('Suggestions:');
    expect(lastFrame()).toContain('Press Enter to download.');
  });

  it('renders notice text when provided', () => {
    const { lastFrame } = render(
      <ModelCustomDownloadView
        downloadDraft="gemma4"
        notice={{ tone: 'error', text: 'Download failed' }}
        theme={THEME.getTheme()}
        onDraftChange={vi.fn()}
        onHighlight={vi.fn()}
        onSelectSuggestion={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(lastFrame()).toContain('Download failed');
  });

  it('forwards TextInput change and submit callbacks', () => {
    const onDraftChange = vi.fn();
    const onSubmit = vi.fn();

    render(
      <ModelCustomDownloadView
        downloadDraft=""
        notice={null}
        theme={THEME.getTheme()}
        onDraftChange={onDraftChange}
        onHighlight={vi.fn()}
        onSelectSuggestion={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    const props = getLastTextInputProps(mockTextInput);
    props.onChange('gemma:latest');
    props.onSubmit('gemma:latest');

    expect(onDraftChange).toHaveBeenCalledWith('gemma:latest');
    expect(onSubmit).toHaveBeenCalledWith('gemma:latest');
  });

  it('passes suggestion props and forwards highlight and select callbacks', () => {
    const onHighlight = vi.fn();
    const onSelectSuggestion = vi.fn();

    render(
      <ModelCustomDownloadView
        downloadDraft="gemma"
        notice={null}
        theme={THEME.getTheme()}
        onDraftChange={vi.fn()}
        onHighlight={onHighlight}
        onSelectSuggestion={onSelectSuggestion}
        onSubmit={vi.fn()}
      />,
    );

    const [props] = mockModelSuggestions.mock.calls.at(-1) ?? [];
    expect(props?.input).toBe('gemma');

    props?.onHighlight?.('gemma:latest');
    props?.onSelect?.('gemma:latest');

    expect(onHighlight).toHaveBeenCalledWith('gemma:latest');
    expect(onSelectSuggestion).toHaveBeenCalledWith('gemma:latest');
  });
});
