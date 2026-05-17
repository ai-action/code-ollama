import { ProgressBar, Spinner } from '@inkjs/ui';
import { Box, Text, useInput } from 'ink';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { MODELS, THEME, UI } from '@/constants';
import type { Config, ThemeDefinition } from '@/types';
import { ollama } from '@/utils';

import { ModelSuggestions } from '../ModelSuggestions';
import { SelectPrompt, SelectPromptHint } from '../SelectPrompt';
import { TextInput } from '../TextInput';

interface Props {
  currentModel: string;
  onSelect: (update: Pick<Config, 'model'>) => void;
  onClose: () => void;
  theme?: ThemeDefinition;
}

enum View {
  Menu = 'menu',
  Switch = 'switch',
  Download = 'download',
  CustomDownload = 'custom-download',
  Downloading = 'downloading',
  Delete = 'delete',
  DeleteConfirm = 'delete-confirm',
}

enum MenuAction {
  Switch = 'switch',
  Download = 'download',
  Delete = 'delete',
  Cancel = 'cancel',
}

enum DownloadAction {
  Custom = 'custom',
  Back = 'back',
}

enum DeleteAction {
  Back = 'back',
}

enum ConfirmDeleteAction {
  Delete = 'delete',
  Back = 'back',
}

interface Notice {
  tone: 'error' | 'info' | 'success';
  text: string;
}

interface DownloadProgressState {
  model: string;
  status: string;
  completed: number;
  total: number;
}

function mergeDownloadProgress(
  previous: DownloadProgressState | null,
  model: string,
  status: string,
  completed: unknown,
  total: unknown,
): DownloadProgressState {
  const nextCompleted =
    typeof completed === 'number' &&
    Number.isFinite(completed) &&
    completed >= 0
      ? completed
      : null;
  const nextTotal =
    typeof total === 'number' && Number.isFinite(total) && total > 0
      ? total
      : null;

  if (nextTotal !== null && nextCompleted !== null) {
    return { model, status, completed: nextCompleted, total: nextTotal };
  }

  const hasPreviousProgress = previous?.model === model && previous.total > 0;

  return {
    model,
    status,
    completed: hasPreviousProgress ? previous.completed : 0,
    total: hasPreviousProgress ? previous.total : 0,
  };
}

function buildMenuOptions() {
  return [
    { label: 'Switch model', value: MenuAction.Switch },
    { label: 'Download model', value: MenuAction.Download },
    { label: 'Delete model', value: MenuAction.Delete },
    { label: 'Cancel', value: MenuAction.Cancel },
  ];
}

function buildInstalledModelOptions(
  models: string[],
  currentModel: string,
  includeCurrentModelNote = false,
) {
  const nextModels = [...models];
  if (nextModels.includes(currentModel)) {
    nextModels.splice(nextModels.indexOf(currentModel), 1);
    nextModels.unshift(currentModel);
  }

  return nextModels.map((model) => ({
    label:
      includeCurrentModelNote && model === currentModel
        ? `${model} (current model)`
        : model,
    value: model,
  }));
}

function buildDownloadOptions() {
  return [
    {
      label: `Enter custom model${UI.ELLIPSIS}`,
      value: DownloadAction.Custom,
    },
    ...MODELS.CATALOG.map(({ label, value }) => ({ label, value })),
    { label: 'Back', value: DownloadAction.Back },
  ];
}

function getNoticeColor(
  tone: Notice['tone'],
  theme: ThemeDefinition,
): string | undefined {
  switch (tone) {
    case 'error':
      return theme.colors.error;
    case 'success':
      return theme.colors.status;
    case 'info':
    default:
      return theme.colors.secondary;
  }
}

function formatBytes(bytes: number): string {
  // v8 ignore next
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let index = 0;

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }

  const fractionDigits = value >= 10 || index === 0 ? 0 : 1;
  return `${value.toFixed(fractionDigits)} ${units[index]}`;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

export function ModelManager({
  currentModel,
  onSelect,
  onClose,
  theme = THEME.getTheme(),
}: Props) {
  const [view, setView] = useState<View>(View.Menu);
  const [installedModels, setInstalledModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [downloadDraft, setDownloadDraft] = useState('');
  const [highlightedSuggestion, setHighlightedSuggestion] = useState<
    string | null
  >(null);
  const [downloadProgress, setDownloadProgress] =
    useState<DownloadProgressState | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const isDeletingRef = useRef(false);
  const pullRef = useRef<{ abort: () => void } | null>(null);

  const loadInstalledModels = useCallback(async () => {
    setIsLoadingModels(true);
    setLoadError(null);

    try {
      setInstalledModels(await ollama.listModels());
    } catch (error: unknown) {
      // v8 ignore start
      setLoadError(error instanceof Error ? error.message : String(error));
      // v8 ignore stop
    } finally {
      setIsLoadingModels(false);
    }
  }, []);

  useEffect(() => {
    void loadInstalledModels();
  }, [loadInstalledModels]);

  const resetDownloadState = useCallback(() => {
    setDownloadDraft('');
    setHighlightedSuggestion(null);
    setDownloadProgress(null);
    pullRef.current = null;
  }, []);

  const handleBackToMenu = useCallback(() => {
    setNotice(null);
    setDeleteCandidate(null);
    setIsDeleting(false);
    isDeletingRef.current = false;
    resetDownloadState();
    setView(View.Menu);
  }, [resetDownloadState]);

  const cancelActivePull = useCallback(() => {
    pullRef.current?.abort();
  }, []);

  useInput((input, key) => {
    if (
      view === View.CustomDownload &&
      (key.escape || (key.ctrl && input === 'c'))
    ) {
      setNotice(null);
      setHighlightedSuggestion(null);
      setView(View.Download);
      return;
    }

    if (
      view === View.Downloading &&
      (key.escape || (key.ctrl && input === 'c'))
    ) {
      cancelActivePull();
      return;
    }
  });

  const handleMenuChange = useCallback(
    (value: string) => {
      setNotice(null);

      switch (value as MenuAction) {
        case MenuAction.Switch:
          setView(View.Switch);
          break;

        case MenuAction.Download:
          setView(View.Download);
          break;

        case MenuAction.Delete:
          setView(View.Delete);
          break;

        case MenuAction.Cancel:
        default:
          onClose();
      }
    },
    [onClose],
  );

  const handleSwitchChange = useCallback(
    (model: string) => {
      onSelect({ model });
    },
    [onSelect],
  );

  const startPull = useCallback(
    async (model: string) => {
      const normalizedModel = model.trim();
      if (!normalizedModel) {
        setNotice({
          tone: 'error',
          text: `${UI.X} Enter a model name to download.`,
        });
        return;
      }

      if (installedModels.includes(normalizedModel)) {
        setNotice({
          tone: 'info',
          text: `${JSON.stringify(normalizedModel)} is already installed.`,
        });
        return;
      }

      setNotice(null);
      setDownloadProgress({
        model: normalizedModel,
        status: 'Starting download...',
        completed: 0,
        total: 0,
      });
      setView(View.Downloading);

      try {
        const pull = await ollama.pullModel(normalizedModel);
        pullRef.current = pull;

        for await (const update of pull) {
          setDownloadProgress((previous) => {
            return mergeDownloadProgress(
              previous,
              normalizedModel,
              update.status,
              update.completed,
              update.total,
            );
          });
        }

        pullRef.current = null;
        resetDownloadState();
        await loadInstalledModels();
        setNotice({
          tone: 'success',
          text: `${UI.CHECKMARK} ${JSON.stringify(normalizedModel)} downloaded successfully.`,
        });
        setView(View.Menu);
      } catch (error: unknown) {
        pullRef.current = null;

        if (isAbortError(error)) {
          setNotice({
            tone: 'error',
            text: `${UI.X} Download canceled for ${JSON.stringify(normalizedModel)}.`,
          });
          setDownloadProgress(null);
          setView(View.Download);
          return;
        }

        // v8 ignore start
        setNotice({
          tone: 'error',
          text: `${UI.X} Error downloading model: ${
            error instanceof Error ? error.message : String(error)
          }`,
        });
        // v8 ignore stop

        setDownloadProgress(null);
        setView(View.CustomDownload);
      }
    },
    [installedModels, loadInstalledModels, resetDownloadState],
  );

  const handleDownloadChange = useCallback(
    (value: string) => {
      if (value === 'custom') {
        setNotice(null);
        setView(View.CustomDownload);
        return;
      }

      if (value === 'back') {
        handleBackToMenu();
        return;
      }

      setDownloadDraft(value);
      void startPull(value);
    },
    [handleBackToMenu, startPull],
  );

  const handleCustomDownloadSubmit = useCallback(
    (value: string) => {
      const nextValue = highlightedSuggestion ?? value.trim();
      setDownloadDraft(nextValue);
      void startPull(nextValue);
    },
    [highlightedSuggestion, startPull],
  );

  const handleDeleteChange = useCallback(
    (model: string) => {
      if (model === 'back') {
        handleBackToMenu();
        return;
      }

      if (model === currentModel) {
        setNotice({
          tone: 'error',
          text: `${UI.X} Switch to a different model before deleting it.`,
        });
        return;
      }

      setNotice(null);
      setDeleteCandidate(model);
      setView(View.DeleteConfirm);
    },
    [currentModel, handleBackToMenu],
  );

  const handleDeleteConfirm = useCallback(
    async (value: string) => {
      if (isDeletingRef.current) {
        return;
      }

      if (value === 'back') {
        setView(View.Delete);
        return;
      }

      // v8 ignore next 3
      if (!deleteCandidate) {
        setView(View.Delete);
        return;
      }

      try {
        isDeletingRef.current = true;
        setIsDeleting(true);
        await ollama.deleteModel(deleteCandidate);
        await loadInstalledModels();
        setNotice({
          tone: 'success',
          text: `${UI.CHECKMARK} ${JSON.stringify(deleteCandidate)} deleted successfully.`,
        });
        isDeletingRef.current = false;
        setIsDeleting(false);
        setDeleteCandidate(null);
        setView(View.Delete);
      } catch (error: unknown) {
        isDeletingRef.current = false;
        setIsDeleting(false);

        // v8 ignore start
        setNotice({
          tone: 'error',
          text: `${UI.X} Error deleting model: ${
            error instanceof Error ? error.message : String(error)
          }`,
        });
        // v8 ignore stop

        setView(View.Delete);
      }
    },
    [deleteCandidate, loadInstalledModels],
  );

  const installedModelOptions = useMemo(
    () => buildInstalledModelOptions(installedModels, currentModel),
    [currentModel, installedModels],
  );
  const deleteModelOptions = useMemo(
    () => [
      ...buildInstalledModelOptions(installedModels, currentModel, true),
      { label: 'Back', value: DeleteAction.Back },
    ],
    [currentModel, installedModels],
  );

  const renderNotice = () =>
    notice ? (
      <Text color={getNoticeColor(notice.tone, theme)}>{notice.text}</Text>
    ) : null;

  if (loadError && view !== View.Menu) {
    return (
      <Box flexDirection="column">
        <Text color={theme.colors.error}>
          Error loading models: {loadError}
        </Text>
        <Text color={theme.colors.secondary} dimColor>
          Press Esc to go back.
        </Text>
      </Box>
    );
  }

  if (view === View.Downloading && downloadProgress) {
    const percent =
      downloadProgress.total > 0 &&
      Number.isFinite(downloadProgress.completed) &&
      Number.isFinite(downloadProgress.total)
        ? Math.round(
            (downloadProgress.completed / downloadProgress.total) * 100,
          )
        : null;

    return (
      <Box flexDirection="column">
        <Text>
          Downloading model:{' '}
          <Text color={theme.colors.model}>{downloadProgress.model}</Text>
        </Text>

        <Text>{downloadProgress.status}</Text>

        {percent !== null ? (
          <>
            <Text>
              {percent}% ({formatBytes(downloadProgress.completed)} /{' '}
              {formatBytes(downloadProgress.total)})
            </Text>
            <ProgressBar value={Math.max(0, Math.min(100, percent))} />
          </>
        ) : (
          <Text color={theme.colors.secondary} dimColor>
            Progress details unavailable. Waiting for Ollama updates...
          </Text>
        )}

        <SelectPrompt
          options={[{ label: 'Cancel download', value: 'cancel-download' }]}
          onCancel={cancelActivePull}
          onChange={cancelActivePull}
        >
          <SelectPromptHint message="Press Enter, Esc, or Ctrl+C to cancel" />
        </SelectPrompt>
      </Box>
    );
  }

  if (view === View.CustomDownload) {
    return (
      <Box flexDirection="column">
        <Text>Enter an Ollama model name to download.</Text>

        <Box>
          <Text>{UI.PROMPT_PREFIX}</Text>
          <TextInput
            value={downloadDraft}
            placeholder="gemma:latest"
            wrapIndent={UI.PROMPT_PREFIX.length}
            onChange={setDownloadDraft}
            onSubmit={handleCustomDownloadSubmit}
          />
        </Box>

        <ModelSuggestions
          catalog={MODELS.CATALOG}
          input={downloadDraft}
          onHighlight={setHighlightedSuggestion}
          // v8 ignore next 3
          onSelect={(value) => {
            setDownloadDraft(value);
            setHighlightedSuggestion(value);
          }}
        />

        {renderNotice()}

        <Text color={theme.colors.secondary} dimColor>
          Press Enter to download, Esc or Ctrl+C to go back.
        </Text>
      </Box>
    );
  }

  if ((view === View.Switch || view === View.Delete) && isLoadingModels) {
    return <Spinner label="Loading models..." />;
  }

  if (view === View.Switch) {
    return (
      <SelectPrompt
        defaultValue={currentModel}
        options={[...installedModelOptions, { label: 'Back', value: 'back' }]}
        onCancel={handleBackToMenu}
        onChange={(value) => {
          if (value === 'back') {
            handleBackToMenu();
            return;
          }

          handleSwitchChange(value);
        }}
      >
        <SelectPromptHint message="Switch models" />
      </SelectPrompt>
    );
  }

  if (view === View.Download) {
    return (
      <SelectPrompt
        options={buildDownloadOptions()}
        onCancel={handleBackToMenu}
        onChange={handleDownloadChange}
      >
        <Text>Choose a model to download or use a custom model name.</Text>
        {renderNotice()}
        <SelectPromptHint message="Download models" />
      </SelectPrompt>
    );
  }

  if (view === View.Delete) {
    return (
      <SelectPrompt
        options={deleteModelOptions}
        onCancel={handleBackToMenu}
        onChange={handleDeleteChange}
      >
        <Text>Delete an installed Ollama model.</Text>
        {renderNotice()}
        <SelectPromptHint message="Delete models" />
      </SelectPrompt>
    );
  }

  if (view === View.DeleteConfirm && deleteCandidate) {
    if (isDeleting) {
      return <Spinner label={`Deleting model ${deleteCandidate}...`} />;
    }

    return (
      <SelectPrompt
        options={[
          {
            label: `Yes, delete model ${JSON.stringify(deleteCandidate)}`,
            value: ConfirmDeleteAction.Delete,
          },
          { label: 'No', value: ConfirmDeleteAction.Back },
        ]}
        onCancel={() => {
          setView(View.Delete);
        }}
        onChange={(value) => {
          void handleDeleteConfirm(value);
        }}
      >
        <Text>
          {UI.WARNING} Delete model{' '}
          <Text color={theme.colors.model}>
            {JSON.stringify(deleteCandidate)}
          </Text>
          ?
        </Text>
        {renderNotice()}
        <SelectPromptHint message="This action cannot be undone" />
      </SelectPrompt>
    );
  }

  return (
    <SelectPrompt
      options={buildMenuOptions()}
      onCancel={onClose}
      onChange={handleMenuChange}
    >
      <Text>
        Current model: <Text color={theme.colors.model}>{currentModel}</Text>
      </Text>
      {renderNotice()}
      <SelectPromptHint message="Manage models" />
    </SelectPrompt>
  );
}
