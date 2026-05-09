export const ACTION_NOT_PERFORMED = 'The requested action was NOT performed';

export const TURN_ABORTED_MESSAGE = [
  '<turn_aborted>',
  'The user interrupted the previous turn on purpose. Any running commands may still be running in the background. If any tools were aborted, they may have partially executed.',
  '</turn_aborted>',
].join('\n');

export const PLAN_CHECKLIST_REMINDER =
  'Then display the execution plan as an unchecked Markdown checklist only';

export const PLAN_EXECUTION_REMINDER =
  'Do not claim success and do not call write_file or run_shell until the user approves execution';
