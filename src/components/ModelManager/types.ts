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
}

export enum ConfirmDeleteAction {
  Delete = 'delete',
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
