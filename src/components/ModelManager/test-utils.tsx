// v8 ignore start
export interface MockSelectProps {
  options: { label: string; value: string }[];
  onChange?: (value: string) => void;
  onCancel?: () => void;
}

export interface MockTextInputProps {
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
}

export function getLastSelectProps(
  mockSelect: ReturnType<typeof vi.fn<(props: MockSelectProps) => void>>,
): MockSelectProps {
  const [props] = mockSelect.mock.calls.at(-1) ?? [];
  if (!props) {
    throw new Error('Expected Select props to be defined.');
  }
  return props;
}

export function getLastTextInputProps(
  mockTextInput: ReturnType<typeof vi.fn<(props: MockTextInputProps) => void>>,
): MockTextInputProps {
  const [props] = mockTextInput.mock.calls.at(-1) ?? [];
  if (!props) {
    throw new Error('Expected TextInput props to be defined.');
  }
  return props;
}
