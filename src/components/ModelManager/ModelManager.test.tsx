import { Text } from 'ink';
import { render } from 'ink-testing-library';

import { time } from '@/utils';

interface MockSelectProps {
  options: { label: string; value: string }[];
  onChange?: (value: string) => void;
  onCancel?: () => void;
}

interface MockTextInputProps {
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
}

const {
  mockDeleteModel,
  mockListModels,
  mockProgressBar,
  mockPullModel,
  mockSelect,
  mockTextInput,
} = vi.hoisted(() => ({
  mockDeleteModel: vi.fn(),
  mockListModels: vi.fn(),
  mockProgressBar: vi.fn<(value: number) => void>(),
  mockPullModel: vi.fn(),
  mockSelect: vi.fn<(props: MockSelectProps) => void>(),
  mockTextInput: vi.fn<(props: MockTextInputProps) => void>(),
}));

vi.mock('@inkjs/ui', async () => {
  const { Text } = await import('ink');
  return {
    ProgressBar: ({ value }: { value: number }) => {
      mockProgressBar(value);
      return <Text>{`Progress:${String(value)}`}</Text>;
    },
    Spinner: ({ label }: { label?: string }) => (
      <Text>{`⏳${label ?? ''}`}</Text>
    ),
    Select: (props: MockSelectProps) => {
      mockSelect(props);
      return (
        <>
          {props.options.map(({ label, value }) => (
            <Text key={value}>{label}</Text>
          ))}
        </>
      );
    },
  };
});

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

vi.mock('./ModelSuggestions', async () => {
  const { useEffect } = await import('react');
  return {
    ModelSuggestions: ({
      input,
      onSelect,
    }: {
      input: string;
      onSelect?: (value: string) => void;
    }) => {
      useEffect(() => {
        if (onSelect && input.includes(':')) {
          onSelect(input);
        }
      }, [input, onSelect]);
      return <Text>{`Suggestions:${input}`}</Text>;
    },
  };
});

vi.mock('@/utils', async () => ({
  ...(await vi.importActual('@/utils')),
  ollama: {
    deleteModel: mockDeleteModel,
    listModels: mockListModels,
    pullModel: mockPullModel,
  },
}));

import { ModelManager } from './ModelManager';

function getLastSelectProps(): MockSelectProps {
  const [props] = mockSelect.mock.calls.at(-1) ?? [];
  expect(props).toBeDefined();
  if (!props) {
    throw new Error('Expected Select props to be defined.');
  }
  return props;
}

function getLastTextInputProps(): MockTextInputProps {
  const [props] = mockTextInput.mock.calls.at(-1) ?? [];
  expect(props).toBeDefined();
  if (!props) {
    throw new Error('Expected TextInput props to be defined.');
  }
  return props;
}

describe('ModelManager', () => {
  beforeEach(() => {
    mockDeleteModel.mockReset();
    mockListModels.mockReset();
    mockProgressBar.mockReset();
    mockPullModel.mockReset();
    mockSelect.mockReset();
    mockTextInput.mockReset();

    mockListModels.mockResolvedValue(['gemma4', 'llama3', 'codellama']);
    mockDeleteModel.mockResolvedValue(undefined);
    mockPullModel.mockResolvedValue({
      abort: vi.fn(),
      async *[Symbol.asyncIterator]() {
        await Promise.resolve();
        yield {
          status: 'done',
          digest: 'abc',
          total: 1,
          completed: 1,
        };
      },
    });
  });

  describe('menu', () => {
    it('renders the parent model management menu', async () => {
      const { lastFrame } = render(
        <ModelManager
          currentModel="gemma4"
          onSelect={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await time.tick(10);

      expect(lastFrame()).toContain('Switch model');
      expect(lastFrame()).toContain('Download model');
      expect(lastFrame()).toContain('Delete model');
      expect(lastFrame()).toContain('Cancel');
    });

    it('calls onClose when selecting cancel from menu', async () => {
      const onClose = vi.fn();
      render(
        <ModelManager
          currentModel="gemma4"
          onSelect={vi.fn()}
          onClose={onClose}
        />,
      );

      await time.tick(10);

      const props = getLastSelectProps();
      props.onChange?.('cancel');
      await time.tick(10);

      expect(onClose).toHaveBeenCalled();
    });

    it('shows error when listModels fails', async () => {
      mockListModels.mockRejectedValueOnce(new Error('Network error'));

      const { lastFrame } = render(
        <ModelManager
          currentModel="gemma4"
          onSelect={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await time.tick(10);

      // Navigate to switch view to see the error (error only shown when not in Menu view)
      const props = getLastSelectProps();
      props.onChange?.('switch');
      await time.tick(10);

      expect(lastFrame()).toContain('Error loading models');
      expect(lastFrame()).toContain('Network error');
    });
  });

  describe('switch view', () => {
    it('renders the model switcher and selects a model', async () => {
      const onSelect = vi.fn();
      render(
        <ModelManager
          currentModel="gemma4"
          onSelect={onSelect}
          onClose={vi.fn()}
        />,
      );

      await time.tick(10);

      let props = getLastSelectProps();
      props.onChange?.('switch');
      await time.tick(10);

      props = getLastSelectProps();
      expect(props.options.map((option) => option.label)).toContain('Back');

      props.onChange?.('llama3');
      expect(onSelect).toHaveBeenCalledWith({ model: 'llama3' });
    });

    it('goes back from switch view via back option', async () => {
      const { lastFrame } = render(
        <ModelManager
          currentModel="gemma4"
          onSelect={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await time.tick(10);

      let props = getLastSelectProps();
      props.onChange?.('switch');
      await time.tick(10);

      expect(lastFrame()).toContain('gemma4');
      expect(lastFrame()).toContain('Back');

      props = getLastSelectProps();
      props.onChange?.('back');
      await time.tick(10);

      const menuProps = getLastSelectProps();
      expect(menuProps.options.map((o) => o.label)).toContain('Switch model');
      expect(menuProps.options.map((o) => o.label)).toContain('Download model');
    });

    it('handles loading state when switching or deleting', async () => {
      let resolveList: ((models: string[]) => void) | undefined;
      mockListModels.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveList = resolve;
        }),
      );

      const { lastFrame } = render(
        <ModelManager
          currentModel="gemma4"
          onSelect={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await time.tick(10);

      const props = getLastSelectProps();
      props.onChange?.('switch');
      await time.tick(10);

      expect(lastFrame()).toContain('Loading models');

      resolveList?.(['gemma4', 'llama3']);
      await time.tick(10);
    });
  });

  describe('download view', () => {
    it('downloads a curated model and returns to the parent menu', async () => {
      mockPullModel.mockResolvedValueOnce({
        abort: vi.fn(),
        async *[Symbol.asyncIterator]() {
          await Promise.resolve();
          yield {
            status: 'pulling',
            digest: 'abc',
            total: 100,
            completed: 50,
          };
        },
      });

      const { lastFrame } = render(
        <ModelManager
          currentModel="gemma4"
          onSelect={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await time.tick(10);

      let props = getLastSelectProps();
      props.onChange?.('download');
      await time.tick(10);

      props = getLastSelectProps();
      props.onChange?.('qwen2.5-coder:7b');
      await time.tick(10);

      expect(mockPullModel).toHaveBeenCalledWith('qwen2.5-coder:7b');
      expect(lastFrame()).toContain('qwen2.5-coder:7b downloaded successfully');
    });

    it('filters curated download options when an exact alias is already installed', async () => {
      mockListModels.mockResolvedValueOnce([
        'gemma4',
        'llama3',
        'qwen2.5-coder:7b',
      ]);

      const { lastFrame } = render(
        <ModelManager
          currentModel="gemma4"
          onSelect={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await time.tick(10);

      const props = getLastSelectProps();
      props.onChange?.('download');
      await time.tick(10);

      const frame = lastFrame() ?? '';
      expect(frame).not.toContain('Qwen 2.5 Coder');
      expect(frame).toContain('Granite 4');
      expect(frame).toContain('Enter custom model');
    });

    it('goes back from download view to menu', async () => {
      const { lastFrame } = render(
        <ModelManager
          currentModel="gemma4"
          onSelect={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await time.tick(10);

      let props = getLastSelectProps();
      props.onChange?.('download');
      await time.tick(10);

      props = getLastSelectProps();
      props.onChange?.('back');
      await time.tick(10);

      expect(lastFrame()).toContain('Switch model');
    });
  });

  describe('downloading', () => {
    it('keeps the progress bar visible for follow-up status updates after 100%', async () => {
      let finishDownload: (() => void) | undefined;
      mockPullModel.mockResolvedValueOnce({
        abort: vi.fn(),
        async *[Symbol.asyncIterator]() {
          await Promise.resolve();
          yield {
            status: 'downloading',
            digest: 'abc',
            total: 100,
            completed: 100,
          };
          yield {
            status: 'verifying',
            digest: 'abc',
            total: 0,
            completed: 0,
          };
          await new Promise<void>((resolve) => {
            finishDownload = resolve;
          });
        },
      });

      const { lastFrame } = render(
        <ModelManager
          currentModel="gemma4"
          onSelect={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await time.tick(10);

      let props = getLastSelectProps();
      props.onChange?.('download');
      await time.tick(10);

      props = getLastSelectProps();
      props.onChange?.('qwen2.5-coder:7b');
      await time.tick(10);

      expect(lastFrame()).toContain('verifying');
      expect(lastFrame()).toContain('100%');
      expect(mockProgressBar).toHaveBeenLastCalledWith(100);

      finishDownload?.();
      await time.tick(10);
    });

    it('keeps prior progress when a later update omits numeric progress fields', async () => {
      let finishDownload: (() => void) | undefined;
      mockPullModel.mockResolvedValueOnce({
        abort: vi.fn(),
        async *[Symbol.asyncIterator]() {
          await Promise.resolve();
          yield {
            status: 'downloading',
            digest: 'abc',
            total: 100,
            completed: 100,
          };
          yield {
            status: 'verifying',
            digest: 'abc',
            total: undefined,
            completed: undefined,
          };
          await new Promise<void>((resolve) => {
            finishDownload = resolve;
          });
        },
      });

      const { lastFrame } = render(
        <ModelManager
          currentModel="gemma4"
          onSelect={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await time.tick(10);

      let props = getLastSelectProps();
      props.onChange?.('download');
      await time.tick(10);

      props = getLastSelectProps();
      props.onChange?.('qwen2.5-coder:7b');
      await time.tick(10);

      expect(lastFrame()).toContain('verifying');
      expect(lastFrame()).toContain('100%');
      expect(lastFrame()).not.toContain('NaN');
      expect(mockProgressBar).toHaveBeenLastCalledWith(100);

      finishDownload?.();
      await time.tick(10);
    });

    it('returns to the download menu after a canceled download', async () => {
      mockPullModel.mockResolvedValueOnce({
        abort: vi.fn(),
        [Symbol.asyncIterator]() {
          return {
            async next() {
              await Promise.resolve();
              throw new DOMException(
                'The operation was aborted.',
                'AbortError',
              );
            },
          };
        },
      });

      const { lastFrame } = render(
        <ModelManager
          currentModel="gemma4"
          onSelect={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await time.tick(10);

      let props = getLastSelectProps();
      props.onChange?.('download');
      await time.tick(10);

      props = getLastSelectProps();
      props.onChange?.('qwen2.5-coder:7b');
      await time.tick(10);

      expect(lastFrame()).toContain('Choose a model to download');
      expect(lastFrame()).toContain('Download canceled');
    });

    it('shows download progress with edge case byte values', async () => {
      let finishDownload: (() => void) | undefined;
      mockPullModel.mockResolvedValueOnce({
        abort: vi.fn(),
        async *[Symbol.asyncIterator]() {
          await Promise.resolve();
          // First yield with zero values to trigger formatBytes edge case
          yield {
            status: 'starting',
            digest: 'abc',
            total: 0,
            completed: 0,
          };
          // Then yield with undefined values
          yield {
            status: 'pulling',
            digest: 'abc',
            total: undefined,
            completed: undefined,
          };
          await new Promise<void>((resolve) => {
            finishDownload = resolve;
          });
        },
      });

      const { lastFrame } = render(
        <ModelManager
          currentModel="gemma4"
          onSelect={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await time.tick(10);

      let props = getLastSelectProps();
      props.onChange?.('download');
      await time.tick(10);

      props = getLastSelectProps();
      props.onChange?.('qwen2.5-coder:7b');
      await time.tick(10);

      expect(lastFrame()).toContain('pulling');

      finishDownload?.();
      await time.tick(10);
    });

    it('shows download progress with large file sizes', async () => {
      let finishDownload: (() => void) | undefined;
      mockPullModel.mockResolvedValueOnce({
        abort: vi.fn(),
        async *[Symbol.asyncIterator]() {
          await Promise.resolve();
          // Yield with large values to trigger formatBytes unit conversion
          yield {
            status: 'downloading',
            digest: 'abc',
            total: 5 * 1024 * 1024 * 1024, // 5 GB
            completed: 2.5 * 1024 * 1024 * 1024, // 2.5 GB
          };
          await new Promise<void>((resolve) => {
            finishDownload = resolve;
          });
        },
      });

      const { lastFrame } = render(
        <ModelManager
          currentModel="gemma4"
          onSelect={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await time.tick(10);

      let props = getLastSelectProps();
      props.onChange?.('download');
      await time.tick(10);

      props = getLastSelectProps();
      props.onChange?.('qwen2.5-coder:7b');
      await time.tick(10);

      expect(lastFrame()).toContain('downloading');
      expect(lastFrame()).toContain('GB');

      finishDownload?.();
      await time.tick(10);
    });

    it('cancels active download with Escape key from downloading view', async () => {
      const abortMock = vi.fn();
      let finishDownload: (() => void) | undefined;

      mockPullModel.mockResolvedValueOnce({
        abort: abortMock,
        async *[Symbol.asyncIterator]() {
          await Promise.resolve();
          yield {
            status: 'downloading',
            digest: 'abc',
            total: 100,
            completed: 50,
          };
          await new Promise<void>((resolve) => {
            finishDownload = resolve;
          });
        },
      });

      const { lastFrame, stdin } = render(
        <ModelManager
          currentModel="gemma4"
          onSelect={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await time.tick(10);

      let props = getLastSelectProps();
      props.onChange?.('download');
      await time.tick(10);

      props = getLastSelectProps();
      props.onChange?.('qwen2.5-coder:7b');
      await time.tick(10);

      expect(lastFrame()).toContain('Downloading model');

      // Press Escape to cancel download
      stdin.write('\x1B\x1B');
      await time.tick(20);

      expect(abortMock).toHaveBeenCalled();

      finishDownload?.();
    });

    it('cancels active download with Ctrl+C', async () => {
      const abortMock = vi.fn();
      let finishDownload: (() => void) | undefined;

      mockPullModel.mockResolvedValueOnce({
        abort: abortMock,
        async *[Symbol.asyncIterator]() {
          await Promise.resolve();
          yield {
            status: 'downloading',
            digest: 'abc',
            total: 100,
            completed: 50,
          };
          await new Promise<void>((resolve) => {
            finishDownload = resolve;
          });
        },
      });

      const { lastFrame, stdin } = render(
        <ModelManager
          currentModel="gemma4"
          onSelect={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await time.tick(10);

      let props = getLastSelectProps();
      props.onChange?.('download');
      await time.tick(10);

      props = getLastSelectProps();
      props.onChange?.('qwen2.5-coder:7b');
      await time.tick(20);

      expect(lastFrame()).toContain('Downloading model');

      // Press Ctrl+C to cancel download
      stdin.write('\x03');
      await time.tick(20);

      expect(abortMock).toHaveBeenCalled();

      finishDownload?.();
    });
  });

  describe('custom download', () => {
    it('shows a validation error for blank custom downloads', async () => {
      const { lastFrame } = render(
        <ModelManager
          currentModel="gemma4"
          onSelect={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await time.tick(10);

      let props = getLastSelectProps();
      props.onChange?.('download');
      await time.tick(10);

      props = getLastSelectProps();
      props.onChange?.('custom');
      await time.tick(10);

      const textInputProps = getLastTextInputProps();
      textInputProps.onSubmit('');
      await time.tick(10);

      expect(lastFrame()).toContain('Enter an Ollama model name to download.');
    });

    it('shows info notice when downloading an already installed model', async () => {
      const { lastFrame } = render(
        <ModelManager
          currentModel="gemma4"
          onSelect={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await time.tick(10);

      let props = getLastSelectProps();
      props.onChange?.('download');
      await time.tick(10);

      props = getLastSelectProps();
      props.onChange?.('custom');
      await time.tick(10);

      const textInputProps = getLastTextInputProps();
      textInputProps.onSubmit('gemma4'); // Already installed
      await time.tick(10);

      expect(lastFrame()).toContain('gemma4 is already installed');
    });

    it('shows error when download fails with non-abort error', async () => {
      mockPullModel.mockResolvedValueOnce({
        abort: vi.fn(),
        [Symbol.asyncIterator]() {
          return {
            async next() {
              await Promise.resolve();
              throw new Error('Network failure');
            },
          };
        },
      });

      const { lastFrame } = render(
        <ModelManager
          currentModel="gemma4"
          onSelect={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await time.tick(10);

      let props = getLastSelectProps();
      props.onChange?.('download');
      await time.tick(10);

      props = getLastSelectProps();
      props.onChange?.('custom');
      await time.tick(10);

      const textInputProps = getLastTextInputProps();
      textInputProps.onSubmit('newmodel');
      await time.tick(10);

      expect(lastFrame()).toContain('Error downloading model');
      expect(lastFrame()).toContain('Network failure');
    });

    it('selects from ModelSuggestions in custom download', async () => {
      const { lastFrame } = render(
        <ModelManager
          currentModel="gemma4"
          onSelect={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await time.tick(10);

      let props = getLastSelectProps();
      props.onChange?.('download');
      await time.tick(10);

      props = getLastSelectProps();
      props.onChange?.('custom');
      await time.tick(10);

      expect(lastFrame()).toContain('Suggestions:');
    });

    it('selects a suggestion from ModelSuggestions in custom download view', async () => {
      const { lastFrame } = render(
        <ModelManager
          currentModel="gemma4"
          onSelect={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await time.tick(10);

      let props = getLastSelectProps();
      props.onChange?.('download');
      await time.tick(10);

      props = getLastSelectProps();
      props.onChange?.('custom');
      await time.tick(10);

      // Simulate typing a value with a colon so the mock ModelSuggestions triggers onSelect
      const textInputProps = getLastTextInputProps();
      textInputProps.onChange('gemma:latest');
      await time.tick(10);

      // The mock ModelSuggestions fires onSelect when input includes ':'
      // This exercises the onSelectSuggestion handler which sets downloadDraft + highlightedSuggestion
      expect(lastFrame()).toContain('gemma:latest');
    });

    it('uses highlightedSuggestion instead of typed value on submit', async () => {
      const { lastFrame } = render(
        <ModelManager
          currentModel="gemma4"
          onSelect={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await time.tick(10);

      let props = getLastSelectProps();
      props.onChange?.('download');
      await time.tick(10);

      props = getLastSelectProps();
      props.onChange?.('custom');
      await time.tick(10);

      // Type a value with ':' so the mock triggers onSelect (sets highlightedSuggestion)
      const textInputProps = getLastTextInputProps();
      textInputProps.onChange('gemma:latest');
      await time.tick(10);

      // Submit triggers pull with the highlighted suggestion
      const updatedTextInputProps = getLastTextInputProps();
      updatedTextInputProps.onSubmit('gemma:latest');
      await time.tick(10);

      expect(mockPullModel).toHaveBeenCalledWith('gemma:latest');
      expect(lastFrame()).toContain('gemma:latest downloaded successfully');
    });

    it('returns to download menu from custom download with Escape', async () => {
      const { lastFrame, stdin } = render(
        <ModelManager
          currentModel="gemma4"
          onSelect={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await time.tick(10);

      let props = getLastSelectProps();
      props.onChange?.('download');
      await time.tick(10);

      props = getLastSelectProps();
      props.onChange?.('custom');
      await time.tick(10);

      expect(getLastTextInputProps().placeholder).toBe('name:tag');

      stdin.write('\x1B\x1B');
      await time.tick(20);

      expect(lastFrame()).toContain('Choose a model to download');
    });

    it('returns to download menu from custom download with Ctrl+C', async () => {
      const { lastFrame, stdin } = render(
        <ModelManager
          currentModel="gemma4"
          onSelect={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await time.tick(10);

      let props = getLastSelectProps();
      props.onChange?.('download');
      await time.tick(10);

      props = getLastSelectProps();
      props.onChange?.('custom');
      await time.tick(10);

      expect(getLastTextInputProps().placeholder).toBe('name:tag');

      stdin.write('\x03');
      await time.tick(20);

      expect(lastFrame()).toContain('Choose a model to download');
    });
  });

  describe('delete view', () => {
    it('does not offer the current model for deletion and confirms deleting another model', async () => {
      const { lastFrame } = render(
        <ModelManager
          currentModel="gemma4"
          onSelect={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await time.tick(10);

      let props = getLastSelectProps();
      props.onChange?.('delete');
      await time.tick(10);

      props = getLastSelectProps();
      expect(props.options.map((option) => option.value)).not.toContain(
        'gemma4',
      );
      expect(lastFrame()).toContain('current model gemma4 cannot be deleted');

      props.onChange?.('llama3');
      await time.tick(10);
      expect(lastFrame()).toContain('Delete model');
      expect(lastFrame()).toContain('Delete model llama3');

      props = getLastSelectProps();
      props.onChange?.('delete');
      await time.tick(10);

      expect(mockDeleteModel).toHaveBeenCalledWith('llama3');
      expect(lastFrame()).toContain('llama3 deleted successfully');
    });

    it('does not submit delete twice while a deletion is in flight', async () => {
      let resolveDelete: (() => void) | undefined;
      mockDeleteModel.mockReturnValueOnce(
        new Promise<void>((resolve) => {
          resolveDelete = resolve;
        }),
      );

      render(
        <ModelManager
          currentModel="gemma4"
          onSelect={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await time.tick(10);

      let props = getLastSelectProps();
      props.onChange?.('delete');
      await time.tick(10);

      props = getLastSelectProps();
      props.onChange?.('llama3');
      await time.tick(10);

      props = getLastSelectProps();
      props.onChange?.('delete');
      props.onChange?.('delete');
      await time.tick(10);

      expect(mockDeleteModel).toHaveBeenCalledTimes(1);

      resolveDelete?.();
      await time.tick(10);
    });

    it('handles delete error gracefully', async () => {
      mockDeleteModel.mockRejectedValueOnce(new Error('Delete failed'));

      const { lastFrame } = render(
        <ModelManager
          currentModel="gemma4"
          onSelect={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await time.tick(10);

      let props = getLastSelectProps();
      props.onChange?.('delete');
      await time.tick(10);

      props = getLastSelectProps();
      props.onChange?.('llama3');
      await time.tick(10);

      props = getLastSelectProps();
      props.onChange?.('delete');
      await time.tick(10);

      expect(lastFrame()).toContain('Error deleting model');
      expect(lastFrame()).toContain('Delete failed');
    });

    it('shows loading spinner when navigating to delete view while models are loading', async () => {
      let resolveList: ((models: string[]) => void) | undefined;
      mockListModels.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveList = resolve;
        }),
      );

      const { lastFrame } = render(
        <ModelManager
          currentModel="gemma4"
          onSelect={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await time.tick(10);

      const props = getLastSelectProps();
      props.onChange?.('delete');
      await time.tick(10);

      expect(lastFrame()).toContain('Loading models');

      resolveList?.(['gemma4', 'llama3']);
      await time.tick(10);
    });

    it('shows deleting spinner while deletion is in progress', async () => {
      let resolveDelete: (() => void) | undefined;
      mockDeleteModel.mockReturnValueOnce(
        new Promise<void>((resolve) => {
          resolveDelete = resolve;
        }),
      );

      const { lastFrame } = render(
        <ModelManager
          currentModel="gemma4"
          onSelect={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await time.tick(10);

      let props = getLastSelectProps();
      props.onChange?.('delete');
      await time.tick(10);

      props = getLastSelectProps();
      props.onChange?.('llama3');
      await time.tick(10);

      props = getLastSelectProps();
      props.onChange?.('delete');
      await time.tick(10);

      expect(lastFrame()).toContain('Deleting model llama3');

      resolveDelete?.();
      await time.tick(10);
    });

    it('goes back from delete view to menu', async () => {
      const { lastFrame } = render(
        <ModelManager
          currentModel="gemma4"
          onSelect={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await time.tick(10);

      let props = getLastSelectProps();
      props.onChange?.('delete');
      await time.tick(10);

      props = getLastSelectProps();
      props.onChange?.('back');
      await time.tick(10);

      expect(lastFrame()).toContain('Switch model');
    });
  });

  describe('delete confirm', () => {
    it('handles delete confirm with back action', async () => {
      const { lastFrame } = render(
        <ModelManager
          currentModel="gemma4"
          onSelect={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await time.tick(10);

      let props = getLastSelectProps();
      props.onChange?.('delete');
      await time.tick(10);

      props = getLastSelectProps();
      props.onChange?.('llama3');
      await time.tick(10);

      expect(lastFrame()).toContain('Delete model llama3');

      // Select "No" (back action)
      props = getLastSelectProps();
      props.onChange?.('back');
      await time.tick(10);

      expect(lastFrame()).toContain('Delete an installed model');
    });

    it('cancels from delete confirm returns to delete list', async () => {
      const { lastFrame, stdin } = render(
        <ModelManager
          currentModel="gemma4"
          onSelect={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await time.tick(10);

      let props = getLastSelectProps();
      props.onChange?.('delete');
      await time.tick(10);

      props = getLastSelectProps();
      props.onChange?.('llama3');
      await time.tick(10);

      expect(lastFrame()).toContain('Delete model llama3');

      // Press Escape to cancel
      stdin.write('\x1B\x1B');
      await time.tick(20);

      expect(lastFrame()).toContain('Delete an installed model');
    });

    it('returns to delete list when confirming delete without candidate', async () => {
      const { lastFrame } = render(
        <ModelManager
          currentModel="gemma4"
          onSelect={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await time.tick(10);

      // Enter delete view
      let props = getLastSelectProps();
      props.onChange?.('delete');
      await time.tick(10);

      // Go back to menu first
      props = getLastSelectProps();
      props.onCancel?.();
      await time.tick(10);

      // Now directly trigger delete confirm with back action
      props = getLastSelectProps();
      props.onChange?.('delete');
      await time.tick(10);

      // Select a model to delete
      props = getLastSelectProps();
      props.onChange?.('llama3');
      await time.tick(10);

      // Cancel from confirm
      props = getLastSelectProps();
      props.onCancel?.();
      await time.tick(10);

      expect(lastFrame()).toContain('Delete an installed model');
    });
  });
});
