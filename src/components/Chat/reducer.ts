import { ChatActionType, InterruptReason } from './constants';
import type { ChatAction, ChatState } from './types';

export function createInitialChatState(
  messages: ChatState['messages'] = [],
): ChatState {
  return {
    messages,
    streamingMessage: null,
    isLoading: false,
    pendingToolCall: null,
    pendingPlan: null,
    interruptReason: null,
  };
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case ChatActionType.AppendMessage:
      return {
        ...state,
        messages: [...state.messages, action.message],
      };

    case ChatActionType.ClearPendingPlan:
      return {
        ...state,
        pendingPlan: null,
      };

    case ChatActionType.ClearPendingToolCall:
      return {
        ...state,
        pendingToolCall: null,
      };

    case ChatActionType.CommitMessages:
      return {
        ...state,
        messages: action.messages,
      };

    case ChatActionType.Interrupt:
      return {
        ...state,
        messages: [...state.messages, action.message],
        streamingMessage: null,
        isLoading: false,
        interruptReason: InterruptReason.Interrupted,
      };

    case ChatActionType.RequestPlanReview:
      return {
        ...state,
        pendingPlan: action.pendingPlan,
        isLoading: false,
      };

    case ChatActionType.RequestToolApproval:
      return {
        ...state,
        pendingToolCall: action.pendingToolCall,
        isLoading: false,
      };

    case ChatActionType.ResetSession:
      return createInitialChatState(action.messages);

    case ChatActionType.SetLoading:
      return {
        ...state,
        isLoading: action.isLoading,
      };

    case ChatActionType.SetStreamingMessage:
      return {
        ...state,
        streamingMessage: action.message,
      };

    case ChatActionType.StartTurn:
      return {
        ...state,
        messages: [...state.messages, action.message],
        isLoading: true,
        interruptReason: null,
      };

    case ChatActionType.ToolRejected:
      return {
        ...state,
        messages: action.messages,
        isLoading: false,
        interruptReason: InterruptReason.Rejected,
      };
  }
}
