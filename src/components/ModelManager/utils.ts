import { MODELS, UI } from '@/constants';
import type { ThemeDefinition } from '@/types';

import {
  DownloadAction,
  type DownloadProgressState,
  MenuAction,
  type Notice,
} from './types';

export function buildMenuOptions() {
  return [
    { label: 'Switch model', value: MenuAction.Switch },
    { label: 'Download model', value: MenuAction.Download },
    { label: 'Delete model', value: MenuAction.Delete },
    { label: 'Cancel', value: MenuAction.Cancel },
  ];
}

export function buildInstalledModelOptions(
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

export function buildDownloadOptions() {
  return [
    {
      label: `Enter custom model${UI.ELLIPSIS}`,
      value: DownloadAction.Custom,
    },
    ...MODELS.CATALOG.map(({ label, value }) => ({ label, value })),
    { label: 'Back', value: DownloadAction.Back },
  ];
}

export function getNoticeColor(
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

export function formatBytes(bytes: number): string {
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

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

export function mergeDownloadProgress(
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
