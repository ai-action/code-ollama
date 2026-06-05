import { Box, Text } from 'ink';
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';

import { prewarmCodeBlocks } from '@/components/CodeBlock';
import { Messages } from '@/components/Messages';
import { TURN_ABORTED_MESSAGE } from '@/components/Messages/constants';
import { PlanReview } from '@/components/PlanReview';
import { ToolApproval } from '@/components/ToolApproval';
import { DECISION, MODE, PROMPT, ROLE, THEME, UI } from '@/constants';
import type { Decision, Mode, ThemeDefinition } from '@/types';
import { ollama, screen, tools } from '@/utils';

import { ChatInput, type SubmittedInput } from './ChatInput';
import { ChatActionType, InterruptReason } from './constants';
import { useRunTurn } from './hooks';
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

/**
 * Gets the latest user interaction plus the assistant response.
 */
function getLatestTurn(messages: ollama.Message[]): ollama.Message[] {
  const latestAssistantIndex = messages.findLastIndex(
    ({ role }) => role === ROLE.ASSISTANT,
  );

  if (latestAssistantIndex >= 0) {
    const latestUserIndex = messages
      .slice(0, latestAssistantIndex)
      .findLastIndex(({ role }) => role === ROLE.USER);

    return [
      // v8 ignore start
      ...(latestUserIndex >= 0 ? [messages[latestUserIndex]] : []),
      // v8 ignore stop
      messages[latestAssistantIndex],
    ];
  }

  const latestUser = messages.findLast(({ role }) => role === ROLE.USER);
  // v8 ignore next
  return latestUser ? [latestUser] : [];
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

  const handleCompact = useCallback(async () => {
    // v8 ignore start
    if (isLoading || pendingPlan || pendingToolCall) {
      setCompactError('Cannot compact while another action is pending.');
      return;
    }
    // v8 ignore stop

    if (!messages.length) {
      setCompactError('Nothing to compact yet.');
      return;
    }

    const modelName = model;
    // v8 ignore next
    if (!modelName) {
      setCompactError('Model is required.');
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    let summary = '';

    setCompactError(null);
    dispatch({
      type: ChatActionType.SetLoading,
      isLoading: true,
    });
    dispatch({
      type: ChatActionType.SetStreamingMessage,
      message: { role: ROLE.ASSISTANT, content: '' },
    });

    try {
      const compactionMessages: ollama.Message[] = [
        ...messages,
        {
          role: ROLE.USER,
          content: PROMPT.COMPACT_MESSAGES_INSTRUCTION,
        },
      ];

      for await (const chunk of ollama.streamChat(
        compactionMessages,
        modelName,
        [],
        controller.signal,
      )) {
        // v8 ignore next 3
        if (chunk.type === 'content') {
          summary = ollama.sanitizeAssistantContent(summary + chunk.content);
        }
      }

      summary = summary.trim();
      if (!summary) {
        throw new Error('Compaction summary was empty');
      }

      await prewarmCodeBlocks(summary, theme);

      const compactedMessages: ollama.Message[] = [
        {
          role: ROLE.SYSTEM,
          content: `Compacted conversation context:\n\n${summary}`,
        },
        ...getLatestTurn(messages),
      ];

      onMessagesReplace?.(compactedMessages);
      persistedSnapshotRef.current = JSON.stringify(compactedMessages);
      dispatch({
        type: ChatActionType.CommitMessages,
        messages: compactedMessages,
      });
      screen.clear(sessionId);
    } catch (error) {
      // v8 ignore start
      if (!controller.signal.aborted) {
        setCompactError(
          `Compaction failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      // v8 ignore stop

      dispatch({
        type: ChatActionType.SetLoading,
        isLoading: false,
      });

      dispatch({
        type: ChatActionType.SetStreamingMessage,
        message: null,
      });
    }
  }, [
    isLoading,
    messages,
    model,
    onMessagesReplace,
    pendingPlan,
    pendingToolCall,
    sessionId,
    theme,
  ]);

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
        await handleCompact();
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
    [handleCompact, messages, mode, onCommand, runTurn, runTurnReadOnly],
  );

  return (
    <Box flexDirection="column">
      <Messages
        messages={messages}
        isLoading={isLoading}
        sessionId={sessionId}
        streamingMessage={streamingMessage}
        theme={theme}
      />

      {pendingPlan && (
        <PlanReview
          planContent={pendingPlan.planContent}
          // eslint-disable-next-line @typescript-eslint/no-misused-promises
          onModeChange={handlePlanReview}
          theme={theme}
        />
      )}

      {!pendingPlan && pendingToolCall && (
        <ToolApproval
          toolCall={pendingToolCall.toolCall}
          // eslint-disable-next-line @typescript-eslint/no-misused-promises
          onDecision={handleToolApproval}
          theme={theme}
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
            theme={theme}
          />
        </Box>
      )}
    </Box>
  );
}
