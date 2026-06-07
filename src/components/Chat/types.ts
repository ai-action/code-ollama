import type { ollama } from '@/utils';

import type { ChatActionType, InterruptReason } from './constants';

export interface PendingToolCall {
  toolCall: ollama.ToolCall;
  messages: ollama.Message[];
}

interface PendingPlan {
  planContent: string;
  messages: ollama.Message[];
}

export interface ChatState {
  messages: ollama.Message[];
  streamingMessage: ollama.Message | null;
  isLoading: boolean;
  pendingToolCall: PendingToolCall | null;
  pendingPlan: PendingPlan | null;
  interruptReason: InterruptReason | null;
}

export type ChatAction =
  | {
      type: ChatActionType.AppendMessage;
      message: ollama.Message;
    }
  | {
      type: ChatActionType.ClearPendingPlan;
    }
  | {
      type: ChatActionType.ClearPendingToolCall;
    }
  | {
      type: ChatActionType.CommitMessages;
      messages: ollama.Message[];
    }
  | {
      type: ChatActionType.Interrupt;
      message: ollama.Message;
    }
  | {
      type: ChatActionType.RequestPlanReview;
      pendingPlan: PendingPlan;
    }
  | {
      type: ChatActionType.RequestToolApproval;
      pendingToolCall: PendingToolCall;
    }
  | {
      type: ChatActionType.ResetSession;
      messages: ollama.Message[];
    }
  | {
      type: ChatActionType.SetLoading;
      isLoading: boolean;
    }
  | {
      type: ChatActionType.SetStreamingMessage;
      message: ollama.Message | null;
    }
  | {
      type: ChatActionType.StartTurn;
      message: ollama.Message;
    }
  | {
      type: ChatActionType.ToolRejected;
      messages: ollama.Message[];
    };
