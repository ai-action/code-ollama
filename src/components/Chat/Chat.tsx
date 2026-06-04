import { Box, Text } from 'ink';
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';

import { prewarmCodeBlocks } from '@/components/CodeBlock';
import { Messages } from '@/components/Messages';
import { TURN_ABORTED_MESSAGE } from '@/components/Messages/constants';
import { PlanReview } from '@/components/PlanReview';
import { ToolApproval } from '@/components/ToolApproval';
import { DECISION, MODE, PROMPT, ROLE, THEME, UI } from '@/constants';
import type { Decision, Mode, ThemeDefinition, ToolResult } from '@/types';
import { agents, ollama, tools } from '@/utils';

import { ChatInput, type SubmittedInput } from './ChatInput';
import {
  ACTION_NOT_PERFORMED,
  ChatActionType,
  InterruptReason,
  PLAN_CHECKLIST_REMINDER,
  PLAN_EXECUTION_REMINDER,
} from './constants';
import {
  hasExecutablePlan,
  isDirectPlanAnswer,
  isPlanModeFinal,
  isPlanNeedsInput,
} from './plan';
import { chatReducer, createInitialChatState } from './reducer';

interface Props {
  initialMessages?: ollama.Message[];
  model?: string;
  onCommand: (command: string) => void;
  onMessagesChange?: (messages: ollama.Message[]) => void;
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  sessionId: string;
  theme?: ThemeDefinition;
}

const MAX_TOOL_TURNS = 25;
const MAX_TOOL_INTENT_CORRECTIONS = 2;

export function Chat({
  initialMessages,
  model,
  onCommand,
  onMessagesChange,
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

  const buildToolResultMessage = useCallback(
    (
      toolName: string,
      result: ToolResult,
      args?: Record<string, unknown>,
    ): ollama.Message => {
      if (result.error?.startsWith('Tool not allowed:')) {
        return {
          role: ROLE.SYSTEM,
          content: [
            `Tool ${toolName} was blocked by execution policy`,
            ACTION_NOT_PERFORMED,
            `Blocked because ${result.error}`,
            'Do not claim success. Either continue with allowed read-only tools or explain that approval/execution mode must change',
          ].join('\n'),
        };
      }

      return {
        role: ROLE.SYSTEM,
        content: tools.formatToolResultContent(toolName, result, args),
        toolResult: {
          name: toolName,
          ...(result.diff ? { diff: result.diff } : {}),
        },
      };
    },
    [],
  );

  const buildPlanModeCorrectionMessage = useCallback(
    (toolName: string): ollama.Message => ({
      role: ROLE.SYSTEM,
      content: [
        `Plan mode policy: ${toolName} cannot be executed during planning`,
        ACTION_NOT_PERFORMED,
        'Continue by using only read-only tools for research if needed',
        PLAN_CHECKLIST_REMINDER,
        PLAN_EXECUTION_REMINDER,
      ].join('\n'),
    }),
    [],
  );

  const handleInterrupt = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    dispatch({
      type: ChatActionType.Interrupt,
      message: { role: ROLE.USER, content: TURN_ABORTED_MESSAGE },
    });
  }, []);

  const processStream = useCallback(
    async (currentMessages: ollama.Message[], executionMode: Mode = mode) => {
      const modelName = model;

      // v8 ignore next
      if (!modelName) {
        throw new Error('Model is required');
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;
      let activeMessages = currentMessages;
      let toolTurns = 0;
      let toolIntentCorrections = 0;

      try {
        while (!controller.signal.aborted) {
          const assistantMessage: ollama.Message = {
            role: ROLE.ASSISTANT,
            content: '',
          };
          let committedMessages = activeMessages;
          let assistantCommitted = false;

          const commitAssistantMessage = () => {
            assistantMessage.content = ollama.sanitizeAssistantContent(
              assistantMessage.content,
            );

            // v8 ignore start
            if (assistantCommitted) {
              if (committedMessages.at(-1)?.role === ROLE.ASSISTANT) {
                committedMessages = [
                  ...committedMessages.slice(0, -1),
                  { ...assistantMessage },
                ];
                dispatch({
                  type: ChatActionType.CommitMessages,
                  messages: committedMessages,
                });
              }
              return committedMessages;
            }
            // v8 ignore stop

            assistantCommitted = true;
            dispatch({
              type: ChatActionType.SetStreamingMessage,
              message: null,
            });

            if (!assistantMessage.content) {
              dispatch({
                type: ChatActionType.CommitMessages,
                messages: committedMessages,
              });
              return committedMessages;
            }

            committedMessages = [...committedMessages, { ...assistantMessage }];
            dispatch({
              type: ChatActionType.CommitMessages,
              messages: committedMessages,
            });
            return committedMessages;
          };

          dispatch({
            type: ChatActionType.SetStreamingMessage,
            message: assistantMessage,
          });
          let nextMessages: ollama.Message[] | null = null;

          for await (const chunk of ollama.streamChat(
            agents.withSystemMessage(activeMessages),
            modelName,
            tools.TOOLS,
            controller.signal,
          )) {
            if (chunk.type === 'content') {
              assistantMessage.content = ollama.sanitizeAssistantContent(
                assistantMessage.content + chunk.content,
              );
              dispatch({
                type: ChatActionType.SetStreamingMessage,
                message: { ...assistantMessage },
              });
              continue;
            }

            if (chunk.tool_calls.length === 0) {
              continue;
            }

            const updatedMessages = commitAssistantMessage();
            const toolResultMessages: ollama.Message[] = [];

            for (const toolCall of chunk.tool_calls) {
              try {
                const normalized = tools.normalizeToolCall(toolCall);

                if (
                  executionMode === MODE.SAFE &&
                  normalized.requiresApproval
                ) {
                  dispatch({
                    type: ChatActionType.RequestToolApproval,
                    pendingToolCall: {
                      toolCall,
                      messages: [...updatedMessages, ...toolResultMessages],
                      executionMode,
                    },
                  });
                  return;
                }

                // v8 ignore next
                const allowedTools =
                  executionMode === MODE.PLAN ? tools.READ_TOOLS : undefined;
                const result = await tools.executeTool(
                  normalized.name,
                  normalized.arguments,
                  { allowedTools },
                );

                toolResultMessages.push(
                  buildToolResultMessage(
                    normalized.name,
                    result,
                    normalized.arguments,
                  ),
                );
              } catch (error) {
                toolResultMessages.push(
                  buildToolResultMessage(toolCall.function.name, {
                    content: '',
                    // v8 ignore next
                    error:
                      error instanceof Error ? error.message : String(error),
                    // v8 ignore next
                    ...(error instanceof Error && error.stack
                      ? { stack: error.stack }
                      : {}),
                  }),
                );
              }
            }

            nextMessages = [...updatedMessages, ...toolResultMessages];
            dispatch({
              type: ChatActionType.CommitMessages,
              messages: nextMessages,
            });
            break;
          }

          if (!nextMessages) {
            await prewarmCodeBlocks(assistantMessage.content, theme);
            const updatedMessages = commitAssistantMessage();

            if (
              ollama.hasUncalledToolIntent(assistantMessage.content) &&
              toolIntentCorrections < MAX_TOOL_INTENT_CORRECTIONS
            ) {
              toolIntentCorrections += 1;
              activeMessages = [
                ...updatedMessages,
                {
                  role: ROLE.SYSTEM,
                  content: ollama.TOOL_INTENT_CORRECTION,
                },
              ];
              dispatch({
                type: ChatActionType.CommitMessages,
                messages: activeMessages,
              });
              continue;
            }

            return;
          }

          toolTurns += 1;
          toolIntentCorrections = 0;
          /* v8 ignore start */
          if (toolTurns >= MAX_TOOL_TURNS) {
            const stoppedMessages: ollama.Message[] = [
              ...nextMessages,
              {
                role: ROLE.SYSTEM,
                content: [
                  'Tool execution stopped because the maximum tool turn limit was reached',
                  ACTION_NOT_PERFORMED,
                  'Summarize completed work and explain what remains without calling more tools.',
                ].join('\n'),
              },
            ];
            dispatch({
              type: ChatActionType.CommitMessages,
              messages: stoppedMessages,
            });
            return;
          }
          /* v8 ignore stop */

          activeMessages = nextMessages;
        }
      } catch (error) {
        // v8 ignore next
        if (!controller.signal.aborted) {
          const errorMessage: ollama.Message = {
            role: ROLE.ASSISTANT,
            content: `Error: ${error instanceof Error ? error.message : String(error)}`,
          };
          await prewarmCodeBlocks(errorMessage.content, theme);
          dispatch({
            type: ChatActionType.SetStreamingMessage,
            message: null,
          });
          dispatch({
            type: ChatActionType.CommitMessages,
            messages: [...activeMessages, errorMessage],
          });
        }
      } finally {
        // v8 ignore next
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
        dispatch({
          type: ChatActionType.SetLoading,
          isLoading: false,
        });
      }
    },
    [buildToolResultMessage, model, mode, theme],
  );

  // Process stream with only read-only tools (for plan mode research phase)
  const processStreamReadOnly = useCallback(
    async (currentMessages: ollama.Message[], toolIntentCorrections = 0) => {
      const modelName = model;

      // v8 ignore next
      if (!modelName) {
        throw new Error('Model is required');
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const assistantMessage: ollama.Message = {
        role: ROLE.ASSISTANT,
        content: '',
      };
      const emptyAssistantMessage: ollama.Message = {
        role: ROLE.ASSISTANT,
        content: '',
      };

      let committedMessages = currentMessages;
      let assistantCommitted = false;

      const commitAssistantMessage = () => {
        assistantMessage.content = ollama.sanitizeAssistantContent(
          assistantMessage.content,
        );

        /* v8 ignore start */
        if (assistantCommitted) {
          if (committedMessages.at(-1)?.role === ROLE.ASSISTANT) {
            committedMessages = [
              ...committedMessages.slice(0, -1),
              { ...assistantMessage },
            ];
            dispatch({
              type: ChatActionType.CommitMessages,
              messages: committedMessages,
            });
          }
          return committedMessages;
        }
        /* v8 ignore stop */

        assistantCommitted = true;
        dispatch({
          type: ChatActionType.SetStreamingMessage,
          message: null,
        });

        if (!assistantMessage.content) {
          dispatch({
            type: ChatActionType.CommitMessages,
            messages: committedMessages,
          });
          return committedMessages;
        }

        committedMessages = [...committedMessages, { ...assistantMessage }];
        dispatch({
          type: ChatActionType.CommitMessages,
          messages: committedMessages,
        });
        return committedMessages;
      };

      dispatch({
        type: ChatActionType.SetStreamingMessage,
        message: emptyAssistantMessage,
      });

      try {
        // Filter to only read-only tools during research phase
        const readOnlyTools = tools.TOOLS.filter((tool) =>
          tools.READ_TOOLS.has(tool.function.name),
        );

        const planResearchMessages: ollama.Message[] = [
          ...currentMessages,
          {
            role: ROLE.SYSTEM,
            content: PROMPT.PLAN_INSTRUCTION,
          },
        ];

        for await (const chunk of ollama.streamChat(
          agents.withSystemMessage(planResearchMessages),
          modelName,
          readOnlyTools,
          controller.signal,
        )) {
          // v8 ignore next 3
          if (controller.signal.aborted) {
            return;
          }
          if (chunk.type === 'content') {
            assistantMessage.content = ollama.sanitizeAssistantContent(
              assistantMessage.content + chunk.content,
            );
            dispatch({
              type: ChatActionType.SetStreamingMessage,
              message: { ...assistantMessage },
            });
            // v8 ignore start
          } else if (
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            chunk.type === 'tool_calls'
            // v8 ignore stop
          ) {
            // Execute read-only tools immediately during research
            for (const toolCall of chunk.tool_calls) {
              const toolName = toolCall.function.name;

              if (!tools.READ_TOOLS.has(toolName)) {
                const correctionMessage =
                  buildPlanModeCorrectionMessage(toolName);

                dispatch({
                  type: ChatActionType.SetStreamingMessage,
                  message: null,
                });
                const newMessages = [...committedMessages, correctionMessage];
                dispatch({
                  type: ChatActionType.CommitMessages,
                  messages: newMessages,
                });

                await processStreamReadOnly(newMessages);
                return;
              }

              dispatch({
                type: ChatActionType.SetStreamingMessage,
                message: emptyAssistantMessage,
              });
              assistantMessage.content = '';
              const updatedMessages = committedMessages;
              let normalized: tools.NormalizedToolCall;

              try {
                normalized = tools.normalizeToolCall(toolCall);
              } catch (error) {
                /* v8 ignore start */
                const toolResultMessage = buildToolResultMessage(
                  toolCall.function.name,
                  {
                    content: '',
                    error:
                      error instanceof Error ? error.message : String(error),
                    // v8 ignore next
                    ...(error instanceof Error && error.stack
                      ? { stack: error.stack }
                      : {}),
                  },
                );

                const newMessages = [...updatedMessages, toolResultMessage];
                dispatch({
                  type: ChatActionType.CommitMessages,
                  messages: newMessages,
                });

                await processStreamReadOnly(newMessages);
                return;
                /* v8 ignore stop */
              }

              const result = await tools.executeTool(
                normalized.name,
                normalized.arguments,
                { allowedTools: tools.READ_TOOLS },
              );

              const toolResultMessage = buildToolResultMessage(
                normalized.name,
                result,
                normalized.arguments,
              );

              const newMessages = [...updatedMessages, toolResultMessage];
              dispatch({
                type: ChatActionType.CommitMessages,
                messages: newMessages,
              });

              // Continue with read-only stream
              await processStreamReadOnly(newMessages);
              return;
            }
          }
        }

        await prewarmCodeBlocks(assistantMessage.content, theme);
        const researchMessages = commitAssistantMessage();

        if (isPlanNeedsInput(assistantMessage.content)) {
          dispatch({
            type: ChatActionType.SetLoading,
            isLoading: false,
          });
          return;
        }

        if (hasExecutablePlan(assistantMessage.content)) {
          dispatch({
            type: ChatActionType.RequestPlanReview,
            pendingPlan: {
              planContent: assistantMessage.content,
              messages: researchMessages,
            },
          });
          return;
        }

        if (
          ollama.hasUncalledToolIntent(assistantMessage.content) &&
          toolIntentCorrections < MAX_TOOL_INTENT_CORRECTIONS
        ) {
          const correctedMessages: ollama.Message[] = [
            ...researchMessages,
            {
              role: ROLE.SYSTEM,
              content: ollama.TOOL_INTENT_CORRECTION,
            },
          ];
          dispatch({
            type: ChatActionType.CommitMessages,
            messages: correctedMessages,
          });
          await processStreamReadOnly(
            correctedMessages,
            toolIntentCorrections + 1,
          );
          return;
        }

        if (isPlanModeFinal(assistantMessage.content)) {
          dispatch({
            type: ChatActionType.SetLoading,
            isLoading: false,
          });
          return;
        }

        const hasToolResults = currentMessages.some(
          (message) => !!message.toolResult,
        );

        if (hasToolResults && isDirectPlanAnswer(assistantMessage.content)) {
          dispatch({
            type: ChatActionType.SetLoading,
            isLoading: false,
          });
          return;
        }

        // Research phase complete - now generate plan with write tools
        // Add instruction to create a plan
        const planInstruction: ollama.Message = {
          role: ROLE.SYSTEM,
          content: PROMPT.PLAN_GENERATION_INSTRUCTION,
        };

        const planMessages = [...researchMessages, planInstruction];

        // Generate the plan
        const planAssistantMessage: ollama.Message = {
          role: ROLE.ASSISTANT,
          content: '',
        };
        dispatch({
          type: ChatActionType.SetStreamingMessage,
          message: emptyAssistantMessage,
        });

        try {
          // Stream plan generation (no tools, just text output)
          for await (const chunk of ollama.streamChat(
            agents.withSystemMessage(planMessages),
            modelName,
            [], // No tools during plan generation output
            controller.signal,
          )) {
            // v8 ignore next 3
            if (controller.signal.aborted) {
              return;
            }
            if (chunk.type === 'content') {
              planAssistantMessage.content = ollama.sanitizeAssistantContent(
                planAssistantMessage.content + chunk.content,
              );
              dispatch({
                type: ChatActionType.SetStreamingMessage,
                message: { ...planAssistantMessage },
              });
            }
          }
        } catch (error) {
          // v8 ignore next
          planAssistantMessage.content = `Error: ${error instanceof Error ? error.message : String(error)}`;
          const errorPlanMessages = [
            ...planMessages,
            { ...planAssistantMessage },
          ];
          dispatch({
            type: ChatActionType.CommitMessages,
            messages: errorPlanMessages,
          });
          dispatch({
            type: ChatActionType.SetStreamingMessage,
            message: null,
          });
          dispatch({
            type: ChatActionType.SetLoading,
            isLoading: false,
          });
          return;
        }

        const finalPlanMessages = [
          ...planMessages,
          { ...planAssistantMessage },
        ];
        dispatch({
          type: ChatActionType.CommitMessages,
          messages: finalPlanMessages,
        });
        dispatch({
          type: ChatActionType.SetStreamingMessage,
          message: null,
        });

        // Store pending plan for approval
        if (hasExecutablePlan(planAssistantMessage.content)) {
          dispatch({
            type: ChatActionType.RequestPlanReview,
            pendingPlan: {
              planContent: planAssistantMessage.content,
              messages: finalPlanMessages,
            },
          });
        }
        dispatch({
          type: ChatActionType.SetLoading,
          isLoading: false,
        });
      } catch (error) {
        // v8 ignore next
        if (!controller.signal.aborted) {
          assistantMessage.content = `Error: ${error instanceof Error ? error.message : String(error)}`;
          await prewarmCodeBlocks(assistantMessage.content, theme);
          commitAssistantMessage();
        }
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
        dispatch({
          type: ChatActionType.SetLoading,
          isLoading: false,
        });
      }
    },
    [buildPlanModeCorrectionMessage, buildToolResultMessage, model, theme],
  );

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

      await processStream(executeMessages, selectedMode);
    },
    [onModeChange, pendingPlan, processStream],
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

          const toolResultMessage = buildToolResultMessage(
            toolCall.function.name,
            result,
            toolCall.function.arguments,
          );

          const newMessages = [...approvedMessages, toolResultMessage];
          dispatch({
            type: ChatActionType.CommitMessages,
            messages: newMessages,
          });

          await processStream(newMessages, executionMode);
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
    [buildToolResultMessage, pendingToolCall, processStream],
  );

  const handleSubmit = useCallback(
    async ({ content, images }: SubmittedInput) => {
      const userContent = content.trim();

      if (!userContent && !images?.length) {
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
        await processStreamReadOnly(updatedMessages);
      } else {
        await processStream(updatedMessages);
      }
    },
    [messages, onCommand, processStream, processStreamReadOnly, mode],
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
