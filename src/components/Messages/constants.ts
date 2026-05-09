export const TURN_ABORTED_MESSAGE = [
  '<turn_aborted>',
  'The user interrupted the previous turn on purpose. Any running commands may still be running in the background. If any tools were aborted, they may have partially executed.',
  '</turn_aborted>',
].join('\n');
