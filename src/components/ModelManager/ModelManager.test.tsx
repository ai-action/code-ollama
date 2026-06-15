import { Text } from 'ink';

import { KEY } from '@/constants';
import { time } from '@/utils';
import { renderWithTheme } from '@/utils/testing';

import { getLastSelectProps, type MockSelectProps } from './test-utils';

interface MockDownloadViewProps {
  installedModels: string[];
  notice: { tone: 'error' | 'info' | 'success'; text: string } | null;
  onCancel: () => void;
  onChange: (value: string) => void;
}

interface MockCustomDownloadViewProps {
  downloadDraft: string;
  notice: { tone: 'error' | 'info' | 'success'; text: string } | null;
  onDraftChange: (value: string) => void;
  onHighlight: (value: string | null) => void;
  onSelectSuggestion: (value: string) => void;
  onSubmit: (value: string) => void;
}

interface MockDownloadingViewProps {
  progress: {
    model: string;
    status: string;
    completed: number;
    total: number;
  };
  onCancel: () => void;
}

interface MockDeleteViewProps {
  currentModel: string;
  installedModels: string[];
  isLoading: boolean;
  notice: { tone: 'error' | 'info' | 'success'; text: string } | null;
  onCancel: () => void;
  onSelect: (model: string) => void;
}

interface MockDeleteConfirmViewProps {
  deleteCandidate: string;
  isDeleting: boolean;
  notice: { tone: 'error' | 'info' | 'success'; text: string } | null;
  onCancel: () => void;
  onConfirm: (value: string) => Promise<void>;
}

interface MockSwitchViewProps {
  currentModel: string;
  installedModels: string[];
  isLoading: boolean;
  onCancel: () => void;
  onSelect: (model: string) => void;
}

const {
  mockDeleteConfirmView,
  mockDeleteModel,
  mockDeleteView,
  mockDownloadView,
  mockDownloadingView,
  mockListModels,
  mockPullModel,
  mockSelect,
  mockCustomDownloadView,
  mockSwitchView,
} = vi.hoisted(() => ({
  mockDeleteConfirmView: vi.fn<(props: MockDeleteConfirmViewProps) => void>(),
  mockDeleteModel: vi.fn(),
  mockDeleteView: vi.fn<(props: MockDeleteViewProps) => void>(),
  mockDownloadView: vi.fn<(props: MockDownloadViewProps) => void>(),
  mockDownloadingView: vi.fn<(props: MockDownloadingViewProps) => void>(),
  mockListModels: vi.fn(),
  mockPullModel: vi.fn(),
  mockSelect: vi.fn<(props: MockSelectProps) => void>(),
  mockCustomDownloadView: vi.fn<(props: MockCustomDownloadViewProps) => void>(),
  mockSwitchView: vi.fn<(props: MockSwitchViewProps) => void>(),
}));

vi.mock('@inkjs/ui', async () => {
  const { Text } = await import('ink');
  return {
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

vi.mock('./ModelDownloadView', () => ({
  ModelDownloadView: (props: MockDownloadViewProps) => {
    mockDownloadView(props);
    return (
      <>
        <Text>DownloadView</Text>
        <Text>{props.notice?.text ?? 'no-notice'}</Text>
      </>
    );
  },
}));

vi.mock('./ModelCustomDownloadView', () => ({
  ModelCustomDownloadView: (props: MockCustomDownloadViewProps) => {
    mockCustomDownloadView(props);
    return (
      <>
        <Text>CustomDownloadView</Text>
        <Text>{props.downloadDraft || 'empty-draft'}</Text>
        <Text>{props.notice?.text ?? 'no-notice'}</Text>
      </>
    );
  },
}));

vi.mock('./ModelDownloadingView', () => ({
  ModelDownloadingView: (props: MockDownloadingViewProps) => {
    mockDownloadingView(props);
    return (
      <>
        <Text>DownloadingView</Text>
        <Text>{props.progress.status}</Text>
        <Text>{`${String(props.progress.completed)}/${String(props.progress.total)}`}</Text>
      </>
    );
  },
}));

vi.mock('./ModelDeleteView', () => ({
  ModelDeleteView: (props: MockDeleteViewProps) => {
    mockDeleteView(props);
    return (
      <>
        <Text>DeleteView</Text>
        <Text>{props.notice?.text ?? 'no-notice'}</Text>
      </>
    );
  },
}));

vi.mock('./ModelDeleteConfirmView', () => ({
  ModelDeleteConfirmView: (props: MockDeleteConfirmViewProps) => {
    mockDeleteConfirmView(props);
    return (
      <>
        <Text>DeleteConfirmView</Text>
        <Text>{props.deleteCandidate}</Text>
        <Text>{props.notice?.text ?? 'no-notice'}</Text>
      </>
    );
  },
}));

vi.mock('./ModelSwitchView', () => ({
  ModelSwitchView: (props: MockSwitchViewProps) => {
    mockSwitchView(props);
    return (
      <>
        <Text>SwitchView</Text>
        <Text>{props.isLoading ? 'loading' : 'loaded'}</Text>
      </>
    );
  },
}));

vi.mock('@/utils', async () => ({
  ...(await vi.importActual('@/utils')),
  ollama: {
    deleteModel: mockDeleteModel,
    listModels: mockListModels,
    pullModel: mockPullModel,
  },
}));

import { ModelManager } from './ModelManager';

function getLastDownloadViewProps(): MockDownloadViewProps {
  const [props] = mockDownloadView.mock.calls.at(-1) ?? [];
  expect(props).toBeDefined();
  if (!props) {
    throw new Error('Expected download view props to be defined.');
  }
  return props;
}

function getLastCustomDownloadViewProps(): MockCustomDownloadViewProps {
  const [props] = mockCustomDownloadView.mock.calls.at(-1) ?? [];
  expect(props).toBeDefined();
  if (!props) {
    throw new Error('Expected custom download view props to be defined.');
  }
  return props;
}

function getLastDownloadingViewProps(): MockDownloadingViewProps {
  const [props] = mockDownloadingView.mock.calls.at(-1) ?? [];
  expect(props).toBeDefined();
  if (!props) {
    throw new Error('Expected downloading view props to be defined.');
  }
  return props;
}

function getLastDeleteViewProps(): MockDeleteViewProps {
  const [props] = mockDeleteView.mock.calls.at(-1) ?? [];
  expect(props).toBeDefined();
  if (!props) {
    throw new Error('Expected delete view props to be defined.');
  }
  return props;
}

function getLastDeleteConfirmViewProps(): MockDeleteConfirmViewProps {
  const [props] = mockDeleteConfirmView.mock.calls.at(-1) ?? [];
  expect(props).toBeDefined();
  if (!props) {
    throw new Error('Expected delete confirm view props to be defined.');
  }
  return props;
}

function getLastSwitchViewProps(): MockSwitchViewProps {
  const [props] = mockSwitchView.mock.calls.at(-1) ?? [];
  expect(props).toBeDefined();
  if (!props) {
    throw new Error('Expected switch view props to be defined.');
  }
  return props;
}

describe('ModelManager', () => {
  beforeEach(() => {
    mockCustomDownloadView.mockReset();
    mockDeleteConfirmView.mockReset();
    mockDeleteModel.mockReset();
    mockDeleteView.mockReset();
    mockDownloadView.mockReset();
    mockDownloadingView.mockReset();
    mockListModels.mockReset();
    mockPullModel.mockReset();
    mockSelect.mockReset();
    mockSwitchView.mockReset();

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
      const { lastFrame } = renderWithTheme(
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

      renderWithTheme(
        <ModelManager
          currentModel="gemma4"
          onSelect={vi.fn()}
          onClose={onClose}
        />,
      );

      await time.tick(10);

      getLastSelectProps(mockSelect).onChange?.('cancel');
      await time.tick(10);

      expect(onClose).toHaveBeenCalled();
    });

    it('shows error when listModels fails', async () => {
      mockListModels.mockRejectedValueOnce(new Error('Network error'));

      const { lastFrame } = renderWithTheme(
        <ModelManager
          currentModel="gemma4"
          onSelect={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await time.tick(10);

      getLastSelectProps(mockSelect).onChange?.('switch');
      await time.tick(10);

      expect(lastFrame()).toContain('Error loading models');
      expect(lastFrame()).toContain('Network error');
    });

    it('returns to the menu from the load error screen with Escape', async () => {
      mockListModels.mockRejectedValueOnce(new Error('fetch failed'));

      const { lastFrame, stdin } = renderWithTheme(
        <ModelManager
          currentModel="gemma4"
          onSelect={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await time.tick(10);

      getLastSelectProps(mockSelect).onChange?.('switch');
      await time.tick(10);

      expect(lastFrame()).toContain('Error loading models: fetch failed');

      stdin.write('\x1B\x1B');
      await time.tick(20);

      expect(lastFrame()).toContain('Switch model');
      expect(lastFrame()).toContain('Download model');
    });

    it('returns to the menu from the load error screen with Ctrl+C', async () => {
      mockListModels.mockRejectedValueOnce(new Error('fetch failed'));

      const { lastFrame, stdin } = renderWithTheme(
        <ModelManager
          currentModel="gemma4"
          onSelect={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await time.tick(10);

      getLastSelectProps(mockSelect).onChange?.('switch');
      await time.tick(10);

      expect(lastFrame()).toContain('Error loading models: fetch failed');

      stdin.write(KEY.CTRL_C);
      await time.tick(20);

      expect(lastFrame()).toContain('Switch model');
      expect(lastFrame()).toContain('Download model');
    });
  });

  it('handles loading state when switching while models are still loading', async () => {
    let resolveList: ((models: string[]) => void) | undefined;
    mockListModels.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveList = resolve;
      }),
    );

    renderWithTheme(
      <ModelManager
        currentModel="gemma4"
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await time.tick(10);

    getLastSelectProps(mockSelect).onChange?.('switch');
    await time.tick(20);

    expect(getLastSwitchViewProps().isLoading).toBe(true);
    resolveList?.(['gemma4', 'llama3']);
    await time.tick(10);
  });

  it('forwards selected models from switch view to onSelect', async () => {
    const onSelect = vi.fn();

    renderWithTheme(
      <ModelManager
        currentModel="gemma4"
        onSelect={onSelect}
        onClose={vi.fn()}
      />,
    );

    await time.tick(20);
    getLastSelectProps(mockSelect).onChange?.('switch');
    await time.tick(20);

    getLastSwitchViewProps().onSelect('llama3');

    expect(onSelect).toHaveBeenCalledWith({ model: 'llama3' });
  });

  describe('download orchestration', () => {
    async function openDownloadView() {
      renderWithTheme(
        <ModelManager
          currentModel="gemma4"
          onSelect={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await time.tick(20);
      getLastSelectProps(mockSelect).onChange?.('download');
      await time.tick(20);
    }

    it('downloads a curated model and returns to the parent menu', async () => {
      await openDownloadView();

      getLastDownloadViewProps().onChange('qwen2.5-coder:7b');
      await time.tick(20);

      expect(mockPullModel).toHaveBeenCalledWith('qwen2.5-coder:7b');
    });

    it('keeps the progress state for follow-up status updates after 100%', async () => {
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

      await openDownloadView();

      getLastDownloadViewProps().onChange('qwen2.5-coder:7b');
      await time.tick(20);

      expect(getLastDownloadingViewProps().progress.status).toBe('verifying');
      expect(getLastDownloadingViewProps().progress.completed).toBe(100);
      expect(getLastDownloadingViewProps().progress.total).toBe(100);

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

      await openDownloadView();

      getLastDownloadViewProps().onChange('qwen2.5-coder:7b');
      await time.tick(20);

      expect(getLastDownloadingViewProps().progress.status).toBe('verifying');
      expect(getLastDownloadingViewProps().progress.completed).toBe(100);
      expect(getLastDownloadingViewProps().progress.total).toBe(100);

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

      const { lastFrame } = renderWithTheme(
        <ModelManager
          currentModel="gemma4"
          onSelect={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await time.tick(20);
      getLastSelectProps(mockSelect).onChange?.('download');
      await time.tick(20);

      getLastDownloadViewProps().onChange('qwen2.5-coder:7b');
      await time.tick(20);

      expect(lastFrame()).toContain('DownloadView');
      expect(lastFrame()).toContain('Download canceled');
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

      const { stdin } = renderWithTheme(
        <ModelManager
          currentModel="gemma4"
          onSelect={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await time.tick(20);
      getLastSelectProps(mockSelect).onChange?.('download');
      await time.tick(20);

      getLastDownloadViewProps().onChange('qwen2.5-coder:7b');
      await time.tick(20);

      stdin.write('\x1B\x1B');
      await time.tick(20);

      expect(abortMock).toHaveBeenCalled();

      finishDownload?.();
    });

    it('shows a validation error for blank custom downloads', async () => {
      const { lastFrame } = renderWithTheme(
        <ModelManager
          currentModel="gemma4"
          onSelect={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await time.tick(20);
      getLastSelectProps(mockSelect).onChange?.('download');
      await time.tick(20);

      getLastDownloadViewProps().onChange('custom');
      await time.tick(20);

      getLastCustomDownloadViewProps().onSubmit('');
      await time.tick(10);

      expect(lastFrame()).toContain('CustomDownloadView');
    });

    it('shows info notice when downloading an already installed model', async () => {
      const { lastFrame } = renderWithTheme(
        <ModelManager
          currentModel="gemma4"
          onSelect={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await time.tick(20);
      getLastSelectProps(mockSelect).onChange?.('download');
      await time.tick(20);

      getLastDownloadViewProps().onChange('custom');
      await time.tick(20);

      getLastCustomDownloadViewProps().onSubmit('gemma4');
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

      const { lastFrame } = renderWithTheme(
        <ModelManager
          currentModel="gemma4"
          onSelect={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await time.tick(20);
      getLastSelectProps(mockSelect).onChange?.('download');
      await time.tick(20);

      getLastDownloadViewProps().onChange('custom');
      await time.tick(20);

      getLastCustomDownloadViewProps().onSubmit('newmodel');
      await time.tick(10);

      expect(lastFrame()).toContain('CustomDownloadView');
      expect(lastFrame()).toContain('Network failure');
    });

    it('uses highlightedSuggestion instead of typed value on submit', async () => {
      await openDownloadView();

      getLastDownloadViewProps().onChange('custom');
      await time.tick(20);

      getLastCustomDownloadViewProps().onHighlight('gemma:latest');
      getLastCustomDownloadViewProps().onSubmit('gemma:latest');
      await time.tick(10);

      expect(mockPullModel).toHaveBeenCalledWith('gemma:latest');
    });

    it('updates the custom download draft when a suggestion is selected', async () => {
      const { lastFrame } = renderWithTheme(
        <ModelManager
          currentModel="gemma4"
          onSelect={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await time.tick(20);
      getLastSelectProps(mockSelect).onChange?.('download');
      await time.tick(20);

      getLastDownloadViewProps().onChange('custom');
      await time.tick(20);

      getLastCustomDownloadViewProps().onSelectSuggestion('gemma:latest');
      await time.tick(20);

      expect(lastFrame()).toContain('gemma:latest');
    });

    it('returns to download menu from custom download with Escape', async () => {
      const { lastFrame, stdin } = renderWithTheme(
        <ModelManager
          currentModel="gemma4"
          onSelect={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await time.tick(20);
      getLastSelectProps(mockSelect).onChange?.('download');
      await time.tick(20);

      getLastDownloadViewProps().onChange('custom');
      await time.tick(20);

      expect(lastFrame()).toContain('CustomDownloadView');

      stdin.write('\x1B\x1B');
      await time.tick(20);

      expect(lastFrame()).toContain('DownloadView');
    });

    it('returns to download menu from custom download with Ctrl+C', async () => {
      const { lastFrame, stdin } = renderWithTheme(
        <ModelManager
          currentModel="gemma4"
          onSelect={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await time.tick(20);
      getLastSelectProps(mockSelect).onChange?.('download');
      await time.tick(20);

      getLastDownloadViewProps().onChange('custom');
      await time.tick(20);

      expect(lastFrame()).toContain('CustomDownloadView');

      stdin.write(KEY.CTRL_C);
      await time.tick(20);

      expect(lastFrame()).toContain('DownloadView');
    });
  });

  describe('delete orchestration', () => {
    async function openDeleteView() {
      renderWithTheme(
        <ModelManager
          currentModel="gemma4"
          onSelect={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await time.tick(20);
      getLastSelectProps(mockSelect).onChange?.('delete');
      await time.tick(20);
    }

    it('deletes another model and returns to delete view with a success notice', async () => {
      const { lastFrame } = renderWithTheme(
        <ModelManager
          currentModel="gemma4"
          onSelect={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await time.tick(20);
      getLastSelectProps(mockSelect).onChange?.('delete');
      await time.tick(20);

      getLastDeleteViewProps().onSelect('llama3');
      await time.tick(20);

      expect(lastFrame()).toContain('DeleteConfirmView');

      await getLastDeleteConfirmViewProps().onConfirm('delete');
      await time.tick(20);

      expect(mockDeleteModel).toHaveBeenCalledWith('llama3');
      expect(lastFrame()).toContain('DeleteView');
      expect(lastFrame()).toContain('llama3 deleted successfully');
    });

    it('does not submit delete twice while a deletion is in flight', async () => {
      let resolveDelete: (() => void) | undefined;
      mockDeleteModel.mockReturnValueOnce(
        new Promise<void>((resolve) => {
          resolveDelete = resolve;
        }),
      );

      await openDeleteView();

      getLastDeleteViewProps().onSelect('llama3');
      await time.tick(20);

      const onConfirm = getLastDeleteConfirmViewProps().onConfirm;
      const first = onConfirm('delete');
      await time.tick();
      const second = onConfirm('delete');
      await time.tick(20);

      expect(mockDeleteModel).toHaveBeenCalledTimes(1);

      resolveDelete?.();
      await first;
      await second;
      await time.tick(10);
    });

    it('handles delete error gracefully', async () => {
      mockDeleteModel.mockRejectedValueOnce(new Error('Delete failed'));

      const { lastFrame } = renderWithTheme(
        <ModelManager
          currentModel="gemma4"
          onSelect={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await time.tick(20);
      getLastSelectProps(mockSelect).onChange?.('delete');
      await time.tick(20);

      getLastDeleteViewProps().onSelect('llama3');
      await time.tick(20);

      await getLastDeleteConfirmViewProps().onConfirm('delete');
      await time.tick(20);

      expect(lastFrame()).toContain('DeleteView');
      expect(lastFrame()).toContain('Delete failed');
    });

    it('returns to the delete list when backing out of delete confirm', async () => {
      const { lastFrame } = renderWithTheme(
        <ModelManager
          currentModel="gemma4"
          onSelect={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await time.tick(20);
      getLastSelectProps(mockSelect).onChange?.('delete');
      await time.tick(20);

      getLastDeleteViewProps().onSelect('llama3');
      await time.tick(20);

      expect(lastFrame()).toContain('DeleteConfirmView');

      await getLastDeleteConfirmViewProps().onConfirm('back');
      await time.tick(20);

      expect(lastFrame()).toContain('DeleteView');
    });

    it('cancels from delete confirm and returns to the delete list', async () => {
      const { lastFrame } = renderWithTheme(
        <ModelManager
          currentModel="gemma4"
          onSelect={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      await time.tick(20);
      getLastSelectProps(mockSelect).onChange?.('delete');
      await time.tick(20);

      getLastDeleteViewProps().onSelect('llama3');
      await time.tick(20);

      expect(lastFrame()).toContain('DeleteConfirmView');

      getLastDeleteConfirmViewProps().onCancel();
      await time.tick(20);

      expect(lastFrame()).toContain('DeleteView');
    });
  });
});
