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
      pendingPlanQuestion: null,
      interruptReason: null,
      toolProgress: [],
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
        plan: {
          kind: 'ready' as const,
          title: 'Plan',
          summary: 'Plan',
          tasks: [
            {
              id: 'task-1',
              description: 'Plan',
              dependencies: [],
              verification: 'Done',
            },
          ],
          tests: [],
          assumptions: [],
          questions: [],
        },
        planContent: 'Plan',
        messages: [userMessage, assistantMessage],
      },
      interruptReason: InterruptReason.Interrupted,
      toolProgress: [],
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
      plan: {
        kind: 'ready' as const,
        title: 'Plan',
        summary: 'Plan',
        tasks: [
          {
            id: 'task-1',
            description: 'Plan',
            dependencies: [],
            verification: 'Done',
          },
        ],
        tests: [],
        assumptions: [],
        questions: [],
      },
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

  it('requests and clears a selectable plan question', () => {
    const pendingPlanQuestion = {
      question: {
        prompt: 'Which behavior?',
        options: ['Safe', 'Fast'],
      },
      planContent: 'Plan needs input',
      messages: [assistantMessage],
    };
    const pendingState = chatReducer(
      { ...createInitialChatState(), isLoading: true },
      {
        type: ChatActionType.RequestPlanQuestion,
        pendingPlanQuestion,
      },
    );

    expect(pendingState).toMatchObject({
      pendingPlanQuestion,
      isLoading: false,
    });
    expect(
      chatReducer(pendingState, {
        type: ChatActionType.ClearPendingPlanQuestion,
      }).pendingPlanQuestion,
    ).toBeNull();
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
      pendingPlanQuestion: null,
      interruptReason: InterruptReason.Interrupted,
      toolProgress: [],
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

  it('tracks transient tool progress', () => {
    const progress: ollama.ToolCallProgress[] = [
      { index: 0, name: 'read_file', status: 'running' },
    ];

    expect(
      chatReducer(createInitialChatState(), {
        type: ChatActionType.SetToolProgress,
        progress,
      }),
    ).toMatchObject({ toolProgress: progress });
  });
});
