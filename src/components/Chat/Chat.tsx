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
import { Stats } from '@/components/Stats';
import { ToolApproval } from '@/components/ToolApproval';
import { DECISION, MODE, ROLE, THEME, UI } from '@/constants';
import type { Decision, Mode, ThemeDefinition } from '@/types';
import { ollama, session, tools } from '@/utils';

import { ChatInput, type SubmittedInput } from './ChatInput';
import { ChatActionType, InterruptReason } from './constants';
import { useCompact, useMessageQueue, useRunTurn } from './hooks';
import { chatReducer, createInitialChatState } from './reducer';
import { ToolProgress } from './ToolProgress';

interface Props {
  initialMessages?: ollama.Message[];
  model?: string;
  onCommand: (command: string) => void;
  onMessagesChange?: (messages: ollama.Message[]) => void;
  onMessagesReplace?: (messages: ollama.Message[]) => void;
  onModelCall?: (stats: ollama.OllamaCallStats) => void;
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  sessionId: string;
  stats?: session.SessionStats;
  theme?: ThemeDefinition;
}

export function Chat({
  initialMessages,
  model,
  onCommand,
  onMessagesChange,
  onMessagesReplace,
  onModelCall,
  mode,
  onModeChange,
  sessionId,
  stats,
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
    toolProgress,
  } = state;
  const abortControllerRef = useRef<AbortController | null>(null);
  const activeTurnRef = useRef(false);
  const persistedSnapshotRef = useRef('');
  const [compactError, setCompactError] = useState<string | null>(null);
  const [showStats, setShowStats] = useState(false);
  const compact = useCompact({
    abortControllerRef,
    dispatch,
    model,
    onMessagesReplace,
    onModelCall,
    persistedSnapshotRef,
    sessionId,
    state: { isLoading, messages, pendingPlan, pendingToolCall },
    theme,
  });

  useEffect(() => {
    setShowStats(false);
  }, [sessionId]);

  useEffect(() => {
    activeTurnRef.current = false;
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
    onModelCall,
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
      activeTurnRef.current = true;

      // Add instruction to execute the plan
      const executeInstruction: ollama.Message = {
        role: ROLE.SYSTEM,
        content:
          mode === MODE.AUTO
            ? 'Execute the plan above. Use tools as needed without asking for further confirmation.'
            : 'Execute the plan above one step at a time. Wait for user approval before each tool call that modifies files or runs commands.',
      };

      const executeMessages = [...planMessages, executeInstruction];

      try {
        await runTurn(executeMessages, selectedMode);
      } finally {
        activeTurnRef.current = false;
      }
    },
    [onModeChange, pendingPlan, runTurn],
  );

  const handleToolApproval = useCallback(
    async (decision: Decision) => {
      // v8 ignore next
      if (!pendingToolCall) {
        return;
      }

      const { messages: approvedMessages, toolCall } = pendingToolCall;
      dispatch({
        type: ChatActionType.ClearPendingToolCall,
      });
      dispatch({
        type: ChatActionType.SetLoading,
        isLoading: true,
      });
      activeTurnRef.current = true;

      try {
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
                // v8 ignore next
                ...(result.error ? { error: result.error } : {}),
              },
            };

            const newMessages = [...approvedMessages, toolResultMessage];
            dispatch({
              type: ChatActionType.CommitMessages,
              messages: newMessages,
            });

            await runTurn(newMessages, mode);
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
      } finally {
        activeTurnRef.current = false;
      }
    },
    [mode, pendingToolCall, runTurn],
  );

  const runUserPrompt = useCallback(
    async ({ content, images }: SubmittedInput) => {
      const userMessage: ollama.Message = {
        role: ROLE.USER,
        content,
        ...(images?.length ? { images } : {}),
      };

      const updatedMessages = [...messages, userMessage];
      dispatch({
        type: ChatActionType.StartTurn,
        message: userMessage,
      });
      activeTurnRef.current = true;

      try {
        if (mode === MODE.PLAN) {
          await runTurnReadOnly(updatedMessages);
        } else {
          await runTurn(updatedMessages);
        }
      } finally {
        activeTurnRef.current = false;
      }
    },
    [messages, mode, runTurn, runTurnReadOnly],
  );

  const { enqueueMessage, queuedMessages, restoreLatestMessage } =
    useMessageQueue({
      isPaused: isLoading || !!pendingPlan || !!pendingToolCall,
      onRunMessage: runUserPrompt,
      resetKey: sessionId,
    });

  const handleSubmit = useCallback(
    async ({ content, images }: SubmittedInput) => {
      const userContent = content.trim();
      setCompactError(null);
      setShowStats(false);

      if (!userContent && !images?.length) {
        return;
      }

      if (activeTurnRef.current || isLoading) {
        if (
          userContent &&
          !images?.length &&
          !userContent.startsWith('/') &&
          !userContent.startsWith('!')
        ) {
          enqueueMessage({ content: userContent });
        }
        return;
      }

      if (userContent === '/compact' && !images?.length) {
        const error = await compact();
        if (error) {
          setCompactError(error);
        }
        return;
      }

      if (userContent === '/stats' && !images?.length) {
        setShowStats(true);
        return;
      }

      if (userContent.startsWith('/')) {
        onCommand(userContent);
        return;
      }

      if (userContent.startsWith('!')) {
        const command = userContent.slice(1).trim();
        if (!command) {
          return;
        }

        dispatch({
          type: ChatActionType.StartTurn,
          message: { role: ROLE.USER, content: userContent },
        });
        activeTurnRef.current = true;

        try {
          const result = await tools.runShell(command);
          const output = result.content.trim();
          const errorLine = result.error ? `\nError: ${result.error}` : '';
          dispatch({
            type: ChatActionType.AppendMessage,
            message: {
              role: ROLE.SYSTEM,
              content: `$ ${command}${output ? `\n${output}` : ''}${errorLine}`,
            },
          });
          dispatch({
            type: ChatActionType.SetLoading,
            isLoading: false,
          });
        } finally {
          activeTurnRef.current = false;
        }
        return;
      }

      await runUserPrompt({ content: userContent, images });
    },
    [compact, enqueueMessage, isLoading, onCommand, runUserPrompt],
  );

  const handleRestoreQueuedMessage = useCallback(() => {
    return restoreLatestMessage()?.content;
  }, [restoreLatestMessage]);

  return (
    <Box flexDirection="column">
      <Messages
        messages={messages}
        isLoading={isLoading}
        sessionId={sessionId}
        streamingMessage={streamingMessage}
      />

      {toolProgress.length > 0 && <ToolProgress progress={toolProgress} />}

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

      {showStats && !isLoading && <Stats stats={stats} />}

      {!pendingPlan && !pendingToolCall && (
        <Box flexDirection="column">
          {queuedMessages.length > 0 && (
            <Box flexDirection="column" marginBottom={1}>
              <Text dimColor>Queued messages:</Text>
              {queuedMessages.map(({ content }, index) => (
                <Box key={index} marginLeft={UI.SCREEN_MARGIN_X}>
                  <Text dimColor italic>
                    ↳ {content}
                  </Text>
                </Box>
              ))}
            </Box>
          )}

          <ChatInput
            history={history}
            isActive={isLoading}
            onInterrupt={handleInterrupt}
            onRestoreQueuedMessage={handleRestoreQueuedMessage}
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            onSubmit={handleSubmit}
          />
        </Box>
      )}
    </Box>
  );
}
