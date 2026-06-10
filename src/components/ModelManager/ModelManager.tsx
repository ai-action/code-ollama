import { Text, useInput } from 'ink';
import { useCallback, useEffect, useRef, useState } from 'react';

import { ExitHint } from '@/components';
import { KEY, UI } from '@/constants';
import { useTheme } from '@/contexts';
import { ollama } from '@/utils';

import { SelectPrompt, SelectPromptHint } from '../SelectPrompt';
import { ModelCustomDownloadView } from './ModelCustomDownloadView';
import { ModelDeleteConfirmView } from './ModelDeleteConfirmView';
import { ModelDeleteView } from './ModelDeleteView';
import { ModelDownloadingView } from './ModelDownloadingView';
import { ModelDownloadView } from './ModelDownloadView';
import { ModelSwitchView } from './ModelSwitchView';
import type { DownloadProgressState, Notice, View } from './types';
import { View as ViewEnum } from './types';
import { buildMenuOptions, isAbortError, mergeDownloadProgress } from './utils';

interface Props {
  currentModel: string;
  onSelect: (update: { model: string }) => void;
  onClose: () => void;
}

export function ModelManager({ currentModel, onSelect, onClose }: Props) {
  const theme = useTheme();
  const [view, setView] = useState<View>(ViewEnum.Menu);
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
      setLoadError(
        error instanceof Error
          ? error.message
          : /* v8 ignore next */ String(error),
      );
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
    setView(ViewEnum.Menu);
  }, [resetDownloadState]);

  const cancelActivePull = useCallback(() => {
    pullRef.current?.abort();
  }, []);

  useInput((input, key) => {
    const isEscape = key.escape || input === KEY.ESCAPE;
    const isCtrlC = (key.ctrl && input === 'c') || input === KEY.CTRL_C;

    if (loadError && view !== ViewEnum.Menu && (isEscape || isCtrlC)) {
      handleBackToMenu();
      return;
    }

    if (view === ViewEnum.CustomDownload && (isEscape || isCtrlC)) {
      setNotice(null);
      setHighlightedSuggestion(null);
      setView(ViewEnum.Download);
      return;
    }

    // v8 ignore next
    if (view === ViewEnum.Downloading && (isEscape || isCtrlC)) {
      cancelActivePull();
    }
  });

  const handleMenuChange = useCallback(
    (value: string) => {
      setNotice(null);

      switch (value) {
        case 'switch':
          setView(ViewEnum.Switch);
          break;
        case 'download':
          setView(ViewEnum.Download);
          break;
        case 'delete':
          setView(ViewEnum.Delete);
          break;
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
          text: `${UI.EXCLAMATION} Enter a model name to download`,
        });
        return;
      }

      if (installedModels.includes(normalizedModel)) {
        setNotice({
          tone: 'info',
          text: `${normalizedModel} is already installed`,
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

      setView(ViewEnum.Downloading);

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
          text: `${UI.CHECKMARK} ${normalizedModel} downloaded successfully`,
        });

        setView(ViewEnum.Menu);
      } catch (error: unknown) {
        pullRef.current = null;

        if (isAbortError(error)) {
          setNotice({
            tone: 'error',
            text: `${UI.X} Download canceled for ${normalizedModel}`,
          });

          setDownloadProgress(null);
          setView(ViewEnum.Download);
          return;
        }

        setNotice({
          tone: 'error',
          text: `${UI.EXCLAMATION} Error downloading model: ${error instanceof Error ? error.message : /* v8 ignore next */ String(error)}`,
        });

        setDownloadProgress(null);
        setView(ViewEnum.CustomDownload);
      }
    },
    [installedModels, loadInstalledModels, resetDownloadState],
  );

  const handleDownloadChange = useCallback(
    (value: string) => {
      if (value === 'custom') {
        setNotice(null);
        setView(ViewEnum.CustomDownload);
        return;
      }

      // v8 ignore next 3
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

  const handleDeleteChange = useCallback((model: string) => {
    setNotice(null);
    setDeleteCandidate(model);
    setView(ViewEnum.DeleteConfirm);
  }, []);

  const handleDeleteConfirm = useCallback(
    async (value: string) => {
      if (isDeletingRef.current) {
        return;
      }

      if (value === 'back') {
        setView(ViewEnum.Delete);
        return;
      }

      // v8 ignore next 3
      if (!deleteCandidate) {
        setView(ViewEnum.Delete);
        return;
      }

      try {
        isDeletingRef.current = true;
        setIsDeleting(true);
        await ollama.deleteModel(deleteCandidate);
        await loadInstalledModels();

        setNotice({
          tone: 'success',
          text: `${UI.CHECKMARK} ${deleteCandidate} deleted successfully`,
        });

        isDeletingRef.current = false;
        setIsDeleting(false);
        setDeleteCandidate(null);
        setView(ViewEnum.Delete);
      } catch (error: unknown) {
        isDeletingRef.current = false;
        setIsDeleting(false);

        setNotice({
          tone: 'error',
          text: `${UI.EXCLAMATION} Error deleting model: ${error instanceof Error ? error.message : /* v8 ignore next */ String(error)}`,
        });

        setView(ViewEnum.Delete);
      }
    },
    [deleteCandidate, loadInstalledModels],
  );

  const renderNotice = () =>
    notice ? (
      <Text
        color={
          // v8 ignore start
          notice.tone === 'error'
            ? theme.colors.error
            : notice.tone === 'success'
              ? theme.colors.status
              : theme.colors.secondary
          // v8 ignore stop
        }
      >
        {notice.text}
      </Text>
    ) : null;

  if (loadError && view !== ViewEnum.Menu) {
    return (
      <>
        <Text color={theme.colors.error}>
          Error loading models: {loadError}
        </Text>
        <ExitHint />
      </>
    );
  }

  if (view === ViewEnum.Downloading && downloadProgress) {
    return (
      <ModelDownloadingView
        progress={downloadProgress}
        onCancel={cancelActivePull}
      />
    );
  }

  if (view === ViewEnum.CustomDownload) {
    return (
      <ModelCustomDownloadView
        downloadDraft={downloadDraft}
        notice={notice}
        onDraftChange={setDownloadDraft}
        onHighlight={setHighlightedSuggestion}
        onSelectSuggestion={(value) => {
          setDownloadDraft(value);
          setHighlightedSuggestion(value);
        }}
        onSubmit={handleCustomDownloadSubmit}
      />
    );
  }

  if (view === ViewEnum.Switch) {
    return (
      <ModelSwitchView
        currentModel={currentModel}
        installedModels={installedModels}
        isLoading={isLoadingModels}
        onCancel={handleBackToMenu}
        onSelect={handleSwitchChange}
      />
    );
  }

  if (view === ViewEnum.Download) {
    return (
      <ModelDownloadView
        installedModels={installedModels}
        notice={notice}
        onCancel={handleBackToMenu}
        onChange={handleDownloadChange}
      />
    );
  }

  if (view === ViewEnum.Delete) {
    return (
      <ModelDeleteView
        currentModel={currentModel}
        installedModels={installedModels}
        isLoading={isLoadingModels}
        notice={notice}
        onCancel={handleBackToMenu}
        onSelect={handleDeleteChange}
      />
    );
  }

  if (view === ViewEnum.DeleteConfirm && deleteCandidate) {
    return (
      <ModelDeleteConfirmView
        deleteCandidate={deleteCandidate}
        isDeleting={isDeleting}
        notice={notice}
        onCancel={() => {
          setView(ViewEnum.Delete);
        }}
        onConfirm={handleDeleteConfirm}
      />
    );
  }

  return (
    <SelectPrompt
      options={buildMenuOptions()}
      onCancel={onClose}
      onChange={handleMenuChange}
    >
      <Text bold underline>
        Manage Models
      </Text>

      {renderNotice()}

      <SelectPromptHint message="Select action" />
    </SelectPrompt>
  );
}
