export const READ_FILE = 'read_file';
export const WRITE_FILE = 'write_file';
export const EDIT_FILE = 'edit_file';
export const RUN_SHELL = 'run_shell';
export const LIST_DIR = 'list_dir';
export const GREP_SEARCH = 'grep_search';
export const VIEW_RANGE = 'view_range';
export const WEB_SEARCH = 'web_search';
export const WEB_FETCH = 'web_fetch';

export const READ_TOOL_NAMES = [
  READ_FILE,
  LIST_DIR,
  GREP_SEARCH,
  VIEW_RANGE,
  WEB_SEARCH,
  WEB_FETCH,
] as const;

export const WRITE_TOOL_NAMES = [WRITE_FILE, EDIT_FILE, RUN_SHELL] as const;
