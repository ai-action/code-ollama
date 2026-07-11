import { useCallback } from 'react';

import { prewarmCodeBlocks } from '@/components/CodeBlock';
import { MODE, PROMPT, ROLE } from '@/constants';
import type { Mode, ThemeDefinition, ToolResult } from '@/types';
import { agents, ollama, tools } from '@/utils';

import {
  ACTION_NOT_PERFORMED,
  ChatActionType,
  PLAN_CHECKLIST_REMINDER,
  PLAN_EXECUTION_REMINDER,
} from '../constants';
import {
  hasExecutablePlan,
  isDirectPlanAnswer,
  isPlanModeFinal,
  isPlanNeedsInput,
} from '../plan';
import type { ChatAction } from '../types';

const MAX_TOOL_TURNS = 25;
const MAX_TOOL_INTENT_CORRECTIONS = 2;

function buildToolResultMessage(
  toolName: string,
  result: ToolResult,
  args?: Record<string, unknown>,
): ollama.Message {
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
}

function buildPlanModeCorrectionMessage(toolName: string): ollama.Message {
  return {
    role: ROLE.SYSTEM,
    content: [
      `Plan mode policy: ${toolName} cannot be executed during planning`,
      ACTION_NOT_PERFORMED,
      'Continue by using only read-only tools for research if needed',
      PLAN_CHECKLIST_REMINDER,
      PLAN_EXECUTION_REMINDER,
    ].join('\n'),
  };
}

interface UseRunTurnOptions {
  abortControllerRef: React.RefObject<AbortController | null>;
  dispatch: React.Dispatch<ChatAction>;
  model: string | undefined;
  mode: Mode;
  theme: ThemeDefinition;
}

/**
 * Hook to run agentic loop (ReAct-style observe → act loop).
 * It runs a multi-turn tool-use conversation with the model until the model stops calling tools (or a limit is hit).
 */
export function useRunTurn({
  abortControllerRef,
  dispatch,
  model,
  mode,
  theme,
}: UseRunTurnOptions) {
  const runTurn = useCallback(
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
            await tools.getToolDefinitions({ mode: executionMode }),
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
            let approvalIndex = chunk.tool_calls.length;

            if (executionMode === MODE.SAFE) {
              approvalIndex = chunk.tool_calls.findIndex((toolCall) => {
                try {
                  const normalized = tools.normalizeToolCall(toolCall);
                  const isBlockedMcpTool =
                    normalized.name.startsWith('mcp__') &&
                    !tools.isMcpToolAllowedInMode(
                      normalized.name,
                      executionMode,
                    );
                  return normalized.requiresApproval && !isBlockedMcpTool;
                } catch {
                  return false;
                }
              });

              if (approvalIndex === -1) {
                approvalIndex = chunk.tool_calls.length;
              }
            }

            const executableCalls = chunk.tool_calls.slice(0, approvalIndex);
            const progress: ollama.ToolCallProgress[] = executableCalls.map(
              (toolCall, index) => ({
                index,
                name: toolCall.function.name,
                status: 'queued',
              }),
            );
            if (progress.length > 0) {
              dispatch({ type: ChatActionType.SetToolProgress, progress });
            }

            // v8 ignore next
            const allowedTools =
              executionMode === MODE.PLAN ? tools.READ_TOOLS : undefined;
            const executed = await tools.executeToolCalls(executableCalls, {
              allowedTools,
              mode: executionMode,
              signal: controller.signal,
              onProgress: (update) => {
                progress[update.index] = update;
                dispatch({
                  type: ChatActionType.SetToolProgress,
                  progress: [...progress],
                });
              },
            });

            for (const { toolCall, result } of executed) {
              toolResultMessages.push(
                buildToolResultMessage(
                  toolCall.function.name,
                  result,
                  toolCall.function.arguments,
                ),
              );
            }

            if (approvalIndex < chunk.tool_calls.length) {
              dispatch({
                type: ChatActionType.RequestToolApproval,
                pendingToolCall: {
                  toolCall: chunk.tool_calls[approvalIndex],
                  messages: [...updatedMessages, ...toolResultMessages],
                },
              });
              return;
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
          // v8 ignore start
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
          // v8 ignore stop

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
        dispatch({ type: ChatActionType.SetToolProgress, progress: [] });
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
    [abortControllerRef, dispatch, model, mode, theme],
  );

  const runTurnReadOnly = useCallback(
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
        message: emptyAssistantMessage,
      });

      try {
        const readOnlyTools = await tools.getToolDefinitions({
          mode: MODE.PLAN,
        });

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
            for (const toolCall of chunk.tool_calls) {
              const toolName = toolCall.function.name;

              if (
                !tools.READ_TOOLS.has(toolName) &&
                !tools.isMcpToolAllowedInMode(toolName, MODE.PLAN)
              ) {
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

                await runTurnReadOnly(newMessages);
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
                // v8 ignore start
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

                await runTurnReadOnly(newMessages);
                return;
                // v8 ignore stop
              }

              const result = await tools.executeTool(
                normalized.name,
                normalized.arguments,
                { allowedTools: tools.READ_TOOLS, mode: MODE.PLAN },
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

              await runTurnReadOnly(newMessages);
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
          await runTurnReadOnly(correctedMessages, toolIntentCorrections + 1);
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

        const planInstruction: ollama.Message = {
          role: ROLE.SYSTEM,
          content: PROMPT.PLAN_GENERATION_INSTRUCTION,
        };

        const planMessages = [...researchMessages, planInstruction];

        const planAssistantMessage: ollama.Message = {
          role: ROLE.ASSISTANT,
          content: '',
        };
        dispatch({
          type: ChatActionType.SetStreamingMessage,
          message: emptyAssistantMessage,
        });

        try {
          for await (const chunk of ollama.streamChat(
            agents.withSystemMessage(planMessages),
            modelName,
            [],
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
    [abortControllerRef, dispatch, model, theme],
  );

  return { runTurn, runTurnReadOnly };
}
