import { tools } from '@/utils';

export const ACTION_NOT_PERFORMED =
  'The requested action did not complete successfully';

export const PLAN_CHECKLIST_REMINDER =
  'Then display the plan using either the Plan Needs Input or Proposed Plan Markdown template';

const PLAN_EXECUTION_TOOLS = Array.from(tools.WRITE_TOOLS).join(', ');

export const PLAN_EXECUTION_REMINDER = `Do not claim success and do not call ${PLAN_EXECUTION_TOOLS} until the user approves execution`;

export enum ChatActionType {
  AppendMessage = 'append-message',
  ClearPendingPlan = 'clear-pending-plan',
  ClearPendingToolCall = 'clear-pending-tool-call',
  CommitMessages = 'commit-messages',
  Interrupt = 'interrupt',
  RequestPlanReview = 'request-plan-review',
  RequestToolApproval = 'request-tool-approval',
  ResetSession = 'reset-session',
  SetLoading = 'set-loading',
  SetStreamingMessage = 'set-streaming-message',
  SetToolProgress = 'set-tool-progress',
  StartTurn = 'start-turn',
  ToolRejected = 'tool-rejected',
}

export enum InterruptReason {
  Interrupted = 'interrupted',
  Rejected = 'rejected',
}
