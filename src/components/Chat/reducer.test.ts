import { ROLE } from '@/constants';
import type { ollama } from '@/utils';

import { ChatActionType, InterruptReason } from './constants';
import { chatReducer, createInitialChatState } from './reducer';
import type { PendingToolCall } from './types';

describe('chatReducer', () => {
  const userMessage: ollama.Message = {
    role: ROLE.USER,
    content: 'Hello',
  };

  const assistantMessage: ollama.Message = {
    role: ROLE.ASSISTANT,
    content: 'Hi',
  };

  it('creates initial state from messages', () => {
    expect(createInitialChatState([userMessage])).toEqual({
      messages: [userMessage],
      streamingMessage: null,
      isLoading: false,
      pendingToolCall: null,
      pendingPlan: null,
      interruptReason: null,
    });
  });

  it('starts a turn by appending the user message and clearing interrupt state', () => {
    const state = {
      ...createInitialChatState(),
      interruptReason: InterruptReason.Rejected,
    };

    expect(
      chatReducer(state, {
        type: ChatActionType.StartTurn,
        message: userMessage,
      }),
    ).toMatchObject({
      messages: [userMessage],
      isLoading: true,
      interruptReason: null,
    });
  });

  it('resets workflow state when the session changes', () => {
    const state = {
      ...createInitialChatState([userMessage]),
      streamingMessage: assistantMessage,
      isLoading: true,
      pendingPlan: {
        planContent: 'Plan',
        messages: [userMessage, assistantMessage],
      },
      interruptReason: InterruptReason.Interrupted,
    };

    expect(
      chatReducer(state, {
        type: ChatActionType.ResetSession,
        messages: [assistantMessage],
      }),
    ).toEqual(createInitialChatState([assistantMessage]));
  });

  it('requests tool approval and pauses loading', () => {
    const pendingToolCall: PendingToolCall = {
      toolCall: {
        function: {
          name: 'write_file',
          arguments: { path: 'file.ts' },
        },
      },
      messages: [userMessage],
      executionMode: 'safe',
    };

    expect(
      chatReducer(
        { ...createInitialChatState([userMessage]), isLoading: true },
        {
          type: ChatActionType.RequestToolApproval,
          pendingToolCall,
        },
      ),
    ).toMatchObject({
      pendingToolCall,
      isLoading: false,
    });
  });

  it('requests plan review and pauses loading', () => {
    const pendingPlan = {
      planContent: '<proposed_plan>Plan</proposed_plan>',
      messages: [assistantMessage],
    };

    expect(
      chatReducer(
        { ...createInitialChatState(), isLoading: true },
        {
          type: ChatActionType.RequestPlanReview,
          pendingPlan,
        },
      ),
    ).toMatchObject({
      pendingPlan,
      isLoading: false,
    });
  });

  it('interrupts by clearing streaming and appending the abort message', () => {
    const abortMessage: ollama.Message = {
      role: ROLE.USER,
      content: 'Turn aborted by user',
    };

    expect(
      chatReducer(
        {
          ...createInitialChatState([userMessage]),
          streamingMessage: assistantMessage,
          isLoading: true,
        },
        {
          type: ChatActionType.Interrupt,
          message: abortMessage,
        },
      ),
    ).toEqual({
      messages: [userMessage, abortMessage],
      streamingMessage: null,
      isLoading: false,
      pendingToolCall: null,
      pendingPlan: null,
      interruptReason: InterruptReason.Interrupted,
    });
  });

  it('marks tool rejection as a stopped state', () => {
    expect(
      chatReducer(createInitialChatState([userMessage]), {
        type: ChatActionType.ToolRejected,
        messages: [userMessage, assistantMessage],
      }),
    ).toMatchObject({
      messages: [userMessage, assistantMessage],
      isLoading: false,
      interruptReason: InterruptReason.Rejected,
    });
  });
});
