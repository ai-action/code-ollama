export const NAME = {
  READ_FILE: 'read_file',
  WRITE_FILE: 'write_file',
  EDIT_FILE: 'edit_file',
  RUN_SHELL: 'run_shell',
  LIST_DIR: 'list_dir',
  GREP_SEARCH: 'grep_search',
  VIEW_RANGE: 'view_range',
} as const;

export type Name = (typeof NAME)[keyof typeof NAME];
