import { tools } from '../../utils';

export const ACTION_NOT_PERFORMED = 'The requested action was NOT performed';

export const PLAN_CHECKLIST_REMINDER =
  'Then display the execution plan as an unchecked Markdown checklist only';

const PLAN_EXECUTION_TOOLS = Array.from(tools.WRITE_TOOLS).join(', ');

export const PLAN_EXECUTION_REMINDER = `Do not claim success and do not call ${PLAN_EXECUTION_TOOLS} until the user approves execution`;

export enum INTERRUPT_REASON {
  INTERRUPTED = 'interrupted',
  REJECTED = 'rejected',
}
