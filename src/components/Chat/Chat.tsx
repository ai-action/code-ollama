import { Box, Text } from 'ink';
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';

import { Messages } from '@/components/Messages';
import { TURN_ABORTED_MESSAGE } from '@/components/Messages/constants';
import { PlanReview } from '@/components/PlanReview';
import { ToolApproval } from '@/components/ToolApproval';
import { DECISION, MODE, ROLE, THEME, UI } from '@/constants';
import type { Decision, Mode, ThemeDefinition } from '@/types';
import { ollama, tools } from '@/utils';

import { ChatInput, type SubmittedInput } from './ChatInput';
import { ChatActionType, InterruptReason } from './constants';
import { useCompact, useRunTurn } from './hooks';
import { chatReducer, createInitialChatState } from './reducer';

interface Props {
  initialMessages?: ollama.Message[];
  model?: string;
  onCommand: (command: string) => void;
  onMessagesChange?: (messages: ollama.Message[]) => void;
  onMessagesReplace?: (messages: ollama.Message[]) => void;
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  sessionId: string;
  theme?: ThemeDefinition;
}

export function Chat({
  initialMessages,
  model,
  onCommand,
  onMessagesChange,
  onMessagesReplace,
  mode,
  onModeChange,
  sessionId,
  theme = THEME.getTheme(),
}: Props) {
  const sessionMessages = initialMessages ?? [];
  const history = useMemo(
    () =>
      sessionMessages.flatMap(({ role, content }) =>
        role === ROLE.USER && !content.startsWith('/') ? [content] : [],
      ),
    [sessionMessages],
  );
  const [state, dispatch] = useReducer(
    chatReducer,
    sessionMessages,
    createInitialChatState,
  );
  const {
    messages,
    streamingMessage,
    isLoading,
    pendingToolCall,
    pendingPlan,
    interruptReason,
  } = state;
  const abortControllerRef = useRef<AbortController | null>(null);
  const persistedSnapshotRef = useRef('');
  const [compactError, setCompactError] = useState<string | null>(null);
  const compact = useCompact({
    abortControllerRef,
    dispatch,
    model,
    onMessagesReplace,
    persistedSnapshotRef,
    sessionId,
    state: { isLoading, messages, pendingPlan, pendingToolCall },
    theme,
  });

  useEffect(() => {
    dispatch({
      type: ChatActionType.ResetSession,
      messages: sessionMessages,
    });
    persistedSnapshotRef.current = JSON.stringify(sessionMessages);
  }, [sessionId]);

  useEffect(() => {
    const snapshot = JSON.stringify(messages);
    if (snapshot === persistedSnapshotRef.current) {
      return;
    }

    persistedSnapshotRef.current = snapshot;
    onMessagesChange?.(messages);
  }, [messages, onMessagesChange]);

  const { runTurn, runTurnReadOnly } = useRunTurn({
    abortControllerRef,
    dispatch,
    model,
    mode,
    theme,
  });

  const handleInterrupt = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    dispatch({
      type: ChatActionType.Interrupt,
      message: { role: ROLE.USER, content: TURN_ABORTED_MESSAGE },
    });
  }, []);

  const handlePlanReview = useCallback(
    async (mode: Mode) => {
      // v8 ignore next
      if (!pendingPlan) {
        return;
      }

      const { messages: planMessages } = pendingPlan;
      dispatch({
        type: ChatActionType.ClearPendingPlan,
      });

      if (mode === MODE.PLAN) {
        onModeChange(MODE.PLAN);
        const cancelMessage: ollama.Message = {
          role: ROLE.SYSTEM,
          content: 'Continuing in Plan mode. No tools were executed.',
        };
        dispatch({
          type: ChatActionType.AppendMessage,
          message: cancelMessage,
        });
        return;
      }

      const selectedMode = mode === MODE.AUTO ? MODE.AUTO : MODE.SAFE;
      onModeChange(selectedMode);
      dispatch({
        type: ChatActionType.SetLoading,
        isLoading: true,
      });

      // Add instruction to execute the plan
      const executeInstruction: ollama.Message = {
        role: ROLE.SYSTEM,
        content:
          mode === MODE.AUTO
            ? 'Execute the plan above. Use tools as needed without asking for further confirmation.'
            : 'Execute the plan above one step at a time. Wait for user approval before each tool call that modifies files or runs commands.',
      };

      const executeMessages = [...planMessages, executeInstruction];

      await runTurn(executeMessages, selectedMode);
    },
    [onModeChange, pendingPlan, runTurn],
  );

  const handleToolApproval = useCallback(
    async (decision: Decision) => {
      // v8 ignore next
      if (!pendingToolCall) {
        return;
      }

      const {
        executionMode,
        messages: approvedMessages,
        toolCall,
      } = pendingToolCall;
      dispatch({
        type: ChatActionType.ClearPendingToolCall,
      });
      dispatch({
        type: ChatActionType.SetLoading,
        isLoading: true,
      });

      switch (decision) {
        case DECISION.APPROVE: {
          dispatch({
            type: ChatActionType.SetStreamingMessage,
            message: { role: ROLE.ASSISTANT, content: '' },
          });
          const result = await tools.executeToolCall(toolCall);

          const toolResultMessage: ollama.Message = {
            role: ROLE.SYSTEM,
            content: tools.formatToolResultContent(
              toolCall.function.name,
              result,
              toolCall.function.arguments,
            ),
            toolResult: {
              name: toolCall.function.name,
              // v8 ignore next
              ...(result.diff ? { diff: result.diff } : {}),
            },
          };

          const newMessages = [...approvedMessages, toolResultMessage];
          dispatch({
            type: ChatActionType.CommitMessages,
            messages: newMessages,
          });

          await runTurn(newMessages, executionMode);
          break;
        }

        case DECISION.REJECT: {
          const toolResultMessage: ollama.Message = {
            role: ROLE.SYSTEM,
            content: tools.formatToolResultContent(
              toolCall.function.name,
              {
                content: '',
                error: 'Tool call rejected by user',
              },
              toolCall.function.arguments,
            ),
          };
          dispatch({
            type: ChatActionType.ToolRejected,
            messages: [...approvedMessages, toolResultMessage],
          });
          break;
        }
      }
    },
    [pendingToolCall, runTurn],
  );

  const handleSubmit = useCallback(
    async ({ content, images }: SubmittedInput) => {
      const userContent = content.trim();
      setCompactError(null);

      if (!userContent && !images?.length) {
        return;
      }

      if (userContent === '/compact' && !images?.length) {
        const error = await compact();
        if (error) {
          setCompactError(error);
        }
        return;
      }

      if (userContent.startsWith('/')) {
        onCommand(userContent);
        return;
      }

      const userMessage: ollama.Message = {
        role: ROLE.USER,
        content: userContent,
        ...(images?.length ? { images } : {}),
      };

      const updatedMessages = [...messages, userMessage];
      dispatch({
        type: ChatActionType.StartTurn,
        message: userMessage,
      });

      // Use plan mode stream if in plan mode, otherwise normal stream
      if (mode === MODE.PLAN) {
        await runTurnReadOnly(updatedMessages);
      } else {
        await runTurn(updatedMessages);
      }
    },
    [compact, messages, mode, onCommand, runTurn, runTurnReadOnly],
  );

  return (
    <Box flexDirection="column">
      <Messages
        messages={messages}
        isLoading={isLoading}
        sessionId={sessionId}
        streamingMessage={streamingMessage}
      />

      {pendingPlan && (
        <PlanReview
          planContent={pendingPlan.planContent}
          // eslint-disable-next-line @typescript-eslint/no-misused-promises
          onModeChange={handlePlanReview}
        />
      )}

      {!pendingPlan && pendingToolCall && (
        <ToolApproval
          toolCall={pendingToolCall.toolCall}
          // eslint-disable-next-line @typescript-eslint/no-misused-promises
          onDecision={handleToolApproval}
        />
      )}

      {interruptReason && !isLoading && (
        <Box marginBottom={1}>
          <Text color={theme.colors.error}>
            {interruptReason === InterruptReason.Rejected
              ? `${UI.EXCLAMATION} Tool call rejected.`
              : `${UI.EXCLAMATION} Execution interrupted.`}
          </Text>
        </Box>
      )}

      {compactError && !isLoading && (
        <Box marginBottom={1}>
          <Text color={theme.colors.error}>{compactError}</Text>
        </Box>
      )}

      {!pendingPlan && !pendingToolCall && (
        <Box marginTop={1}>
          <ChatInput
            history={history}
            isDisabled={isLoading}
            onInterrupt={handleInterrupt}
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            onSubmit={handleSubmit}
          />
        </Box>
      )}
    </Box>
  );
}
