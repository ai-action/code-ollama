import type { ThemeDefinition } from '@/types';

export interface ModelManagerProps {
  currentModel: string;
  onSelect: (update: { model: string }) => void;
  onClose: () => void;
  theme?: ThemeDefinition;
}

export enum View {
  Menu = 'menu',
  Switch = 'switch',
  Download = 'download',
  CustomDownload = 'custom-download',
  Downloading = 'downloading',
  Delete = 'delete',
  DeleteConfirm = 'delete-confirm',
}

export enum MenuAction {
  Switch = 'switch',
  Download = 'download',
  Delete = 'delete',
  Cancel = 'cancel',
}

export enum DownloadAction {
  Custom = 'custom',
  Back = 'back',
}

export enum DeleteAction {
  Back = 'back',
}

export enum ConfirmDeleteAction {
  Delete = 'delete',
  Back = 'back',
}

export interface Notice {
  tone: 'error' | 'info' | 'success';
  text: string;
}

export interface DownloadProgressState {
  model: string;
  status: string;
  completed: number;
  total: number;
}
