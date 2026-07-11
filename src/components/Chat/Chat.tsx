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
import { agents, memory, ollama, tools } from '@/utils';

import { ChatInput, type SubmittedInput } from './ChatInput';
import { MEMORY_COMMANDS } from './CommandMenu';
import { ChatActionType, InterruptReason } from './constants';
import { useCompact, useRunTurn } from './hooks';
import { chatReducer, createInitialChatState } from './reducer';
import { ToolProgress } from './ToolProgress';

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

function getMemoryCommandResult(command: string): string {
  const normalizedCommand = command.trim().toLowerCase();
  const matchingSubmitCommands = MEMORY_COMMANDS.filter(
    ({ value }) =>
      value.shouldSubmit &&
      value.text.toLowerCase().startsWith(normalizedCommand),
  );
  const resolvedCommand =
    matchingSubmitCommands.length === 1
      ? matchingSubmitCommands[0].value.text
      : command;
  const [, subcommand = 'show', ...args] = resolvedCommand.split(/\s+/);

  switch (subcommand) {
    case 'show':
      return memory.showMemory();

    case 'path':
      return memory.getMemoryPathSummary();

    case 'add': {
      const isGlobal = args[0] === '--global';
      const text = (isGlobal ? args.slice(1) : args).join(' ').trim();
      const path = memory.appendMemory(text, {
        scope: isGlobal ? 'global' : 'project',
      });
      agents.resetSystemMessage();
      return `Memory saved to ${path}`;
    }

    default:
      return [
        'Unknown memory command.',
        'Usage:',
        '/memory show',
        '/memory path',
        '/memory add <text>',
        '/memory add --global <text>',
      ].join('\n');
  }
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
    toolProgress,
  } = state;
  const abortControllerRef = useRef<AbortController | null>(null);
  const activeTurnRef = useRef(false);
  const isDrainingQueueRef = useRef(false);
  const persistedSnapshotRef = useRef('');
  const [compactError, setCompactError] = useState<string | null>(null);
  const [isDrainingQueue, setIsDrainingQueue] = useState(false);
  const [queuedMessages, setQueuedMessages] = useState<SubmittedInput[]>([]);
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
    activeTurnRef.current = false;
    isDrainingQueueRef.current = false;
    setIsDrainingQueue(false);
    setQueuedMessages([]);
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

  const handleSubmit = useCallback(
    async ({ content, images }: SubmittedInput) => {
      const userContent = content.trim();
      setCompactError(null);

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
          setQueuedMessages((current) => [
            ...current,
            { content: userContent },
          ]);
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

      if (
        (userContent === '/memory' || userContent.startsWith('/memory ')) &&
        !images?.length
      ) {
        try {
          dispatch({
            type: ChatActionType.AppendMessage,
            message: {
              role: ROLE.SYSTEM,
              content: getMemoryCommandResult(userContent),
            },
          });
        } catch (error) {
          dispatch({
            type: ChatActionType.AppendMessage,
            message: {
              role: ROLE.SYSTEM,
              content: `Memory command failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          });
        }
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
    [compact, isLoading, onCommand, runUserPrompt],
  );

  useEffect(() => {
    if (
      isLoading ||
      pendingPlan ||
      pendingToolCall ||
      !queuedMessages.length ||
      isDrainingQueue ||
      isDrainingQueueRef.current
    ) {
      return;
    }

    const [nextMessage] = queuedMessages;
    isDrainingQueueRef.current = true;
    setIsDrainingQueue(true);
    setQueuedMessages((current) => current.slice(1));
    void runUserPrompt(nextMessage).finally(() => {
      isDrainingQueueRef.current = false;
      setIsDrainingQueue(false);
    });
  }, [
    isDrainingQueue,
    isLoading,
    pendingPlan,
    pendingToolCall,
    queuedMessages,
    runUserPrompt,
  ]);

  const handleRestoreQueuedMessage = useCallback(() => {
    const nextMessage = queuedMessages.at(-1);
    if (!nextMessage) {
      return undefined;
    }

    setQueuedMessages((current) => current.slice(0, -1));
    return nextMessage.content;
  }, [queuedMessages]);

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

      {!pendingPlan && !pendingToolCall && (
        <Box flexDirection="column">
          {queuedMessages.length > 0 && (
            <Box flexDirection="column" marginBottom={1}>
              <Text dimColor>Queued messages:</Text>
              {queuedMessages.map(({ content }, index) => (
                <Text key={`${String(index)}-${content}`} dimColor italic>
                  {'  ↳ '}
                  {content}
                </Text>
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
