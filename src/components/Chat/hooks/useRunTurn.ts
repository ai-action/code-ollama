import { useCallback } from 'react';

import { prewarmCodeBlocks } from '@/components/CodeBlock';
import { MODE, PROMPT, ROLE, TOOL } from '@/constants';
import type { Mode, ThemeDefinition, ToolResult } from '@/types';
import { agents, ollama, tools } from '@/utils';

import {
  ACTION_NOT_PERFORMED,
  ChatActionType,
  PLAN_EXECUTION_REMINDER,
} from '../constants';
import { parsePlan, renderPlan, validatePlanProposal } from '../plan';
import type { ChatAction } from '../types';
import {
  buildFailedMutationCorrection,
  buildVerificationCorrection,
  createExecutionVerification,
  type ExecutionVerification,
  getPendingMutationTargets,
  mayToolMutate,
  reportsVerificationBlocked,
  reportsVerifiedNoChange,
  resolveVerifiedNoChange,
  updateExecutionVerification,
} from '../verification';

const MAX_TOOL_TURNS = 25;
const MAX_TOOL_INTENT_CORRECTIONS = 2;
const MAX_EMPTY_RESPONSE_CORRECTIONS = 2;
const MAX_PLAN_EXECUTION_CORRECTIONS = 2;
const MAX_FAILED_MUTATION_CORRECTIONS = 2;
const MAX_VERIFICATION_CORRECTIONS = 2;
const MAX_INCOMPLETE_RESPONSE_CORRECTIONS = 1;
const MAX_TERMINAL_TOOL_CORRECTIONS = 1;
const STREAMING_UPDATE_INTERVAL_MS = 50;
const SERIALIZED_TOOL_CALL_MESSAGE =
  'The model printed a tool call instead of invoking it.';

type IncompleteResponse =
  | Exclude<ollama.AssistantContentClassification['type'], 'complete'>
  | 'thinking-only';
type TerminalToolValidation<T> =
  | { status: 'accepted'; value: T }
  | { status: 'recoverable-error'; error: string };

interface StreamAssistantTurnOptions {
  dispatch: React.Dispatch<ChatAction>;
  messages: ollama.Message[];
  model: string;
  onModelCall?: (stats: ollama.OllamaCallStats) => void;
  signal: AbortSignal;
  toolDefinitions: Awaited<ReturnType<typeof tools.getToolDefinitions>>;
}

function classifyIncompleteResponse(
  content: string,
  hadThinking: boolean,
): IncompleteResponse | null {
  const classification = ollama.classifyAssistantContent(content);
  if (classification.type === 'empty' && hadThinking) {
    return 'thinking-only';
  }
  return classification.type === 'complete' ? null : classification.type;
}

function buildIncompleteResponseCorrection(
  incompleteResponse: IncompleteResponse,
  hasToolResults: boolean,
): string {
  if (incompleteResponse === 'thinking-only') {
    return 'You completed reasoning without providing a final response. Respond now with user-facing content or call the appropriate tool.';
  }
  if (incompleteResponse !== 'empty') {
    return ollama.TOOL_INTENT_CORRECTION;
  }
  return hasToolResults
    ? 'A tool result was returned but the turn has not been completed. Continue now by calling the next required tool or report the completed outcome.'
    : 'The response was empty and the turn has not been completed. Respond now or call the required tool.';
}

function validateTerminalToolCall<T>(
  toolCall: ollama.ToolCall,
  validate: (value: unknown) => T,
): TerminalToolValidation<T> {
  try {
    return {
      status: 'accepted',
      value: validate(toolCall.function.arguments),
    };
  } catch (error) {
    return {
      status: 'recoverable-error',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function buildTerminalToolCorrection(toolName: string, error: string): string {
  return [
    `Terminal tool ${toolName} was rejected: ${error}`,
    `Call ${toolName} again as one standalone tool call with corrected arguments.`,
    'Do not respond with prose or announce the tool call.',
  ].join('\n');
}

async function streamAssistantTurn({
  dispatch,
  messages,
  model,
  onModelCall,
  signal,
  toolDefinitions,
}: StreamAssistantTurnOptions): Promise<{
  assistantMessage: ollama.Message;
  hadThinking: boolean;
  toolCalls: ollama.ToolCall[];
}> {
  const assistantMessage: ollama.Message = {
    role: ROLE.ASSISTANT,
    content: '',
  };
  let lastStreamingUpdateAt = Date.now();
  let hasRenderedStreamingContent = false;
  let hadThinking = false;
  let toolCalls: ollama.ToolCall[] = [];

  dispatch({
    type: ChatActionType.SetStreamingMessage,
    message: assistantMessage,
  });

  for await (const chunk of ollama.streamChat(
    messages,
    model,
    toolDefinitions,
    signal,
  )) {
    if (signal.aborted) {
      break;
    }
    if (chunk.type === 'content') {
      assistantMessage.content = ollama.sanitizeAssistantContent(
        assistantMessage.content + chunk.content,
      );
      const now = Date.now();
      if (
        (!hasRenderedStreamingContent ||
          now - lastStreamingUpdateAt >= STREAMING_UPDATE_INTERVAL_MS) &&
        !ollama.hasSerializedToolCall(assistantMessage.content)
      ) {
        lastStreamingUpdateAt = now;
        hasRenderedStreamingContent = true;
        dispatch({
          type: ChatActionType.SetStreamingMessage,
          message: { ...assistantMessage },
        });
      }
      continue;
    }
    if (chunk.type === 'stats') {
      onModelCall?.(chunk.stats);
      continue;
    }
    if (chunk.type === 'thinking') {
      hadThinking = true;
      continue;
    }
    if (chunk.tool_calls.length > 0) {
      toolCalls = chunk.tool_calls;
    }
  }

  assistantMessage.content = ollama.sanitizeAssistantContent(
    assistantMessage.content,
  );
  return { assistantMessage, hadThinking, toolCalls };
}

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

  const content = tools.formatToolResultContent(toolName, result, args);
  return {
    role: ROLE.SYSTEM,
    content:
      result.error && mayToolMutate(toolName)
        ? `${content}\n${buildFailedMutationCorrection(toolName)}`
        : content,
    toolResult: {
      name: toolName,
      ...(result.diff ? { diff: result.diff } : {}),
      ...(result.error ? { error: result.error } : {}),
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
      PLAN_EXECUTION_REMINDER,
    ].join('\n'),
  };
}

interface UseRunTurnOptions {
  abortControllerRef: React.RefObject<AbortController | null>;
  dispatch: React.Dispatch<ChatAction>;
  model: string | undefined;
  mode: Mode;
  onModelCall?: (stats: ollama.OllamaCallStats) => void;
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
  onModelCall,
  theme,
}: UseRunTurnOptions) {
  const runTurn = useCallback(
    async (
      currentMessages: ollama.Message[],
      executionMode: Mode = mode,
      initialVerification?: ExecutionVerification,
    ) => {
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
      let emptyResponseCorrections = 0;
      let verificationCorrections = 0;
      let planExecutionCorrections = 0;
      let failedMutationCorrections = 0;
      let verification = initialVerification
        ? { ...initialVerification }
        : createExecutionVerification();

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

          let nextMessages: ollama.Message[] | null = null;
          const streamedTurn = await streamAssistantTurn({
            dispatch,
            messages: agents.withSystemMessage(activeMessages),
            model: modelName,
            onModelCall,
            signal: controller.signal,
            toolDefinitions: await tools.getToolDefinitions({
              mode: executionMode,
            }),
          });
          assistantMessage.content = streamedTurn.assistantMessage.content;

          if (streamedTurn.toolCalls.length > 0) {
            const updatedMessages = commitAssistantMessage();
            const toolResultMessages: ollama.Message[] = [];
            let approvalIndex = streamedTurn.toolCalls.length;

            if (executionMode === MODE.SAFE) {
              approvalIndex = streamedTurn.toolCalls.findIndex((toolCall) => {
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
                approvalIndex = streamedTurn.toolCalls.length;
              }
            }

            const executableCalls = streamedTurn.toolCalls.slice(
              0,
              approvalIndex,
            );
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
            });

            for (const { toolCall, result } of executed) {
              verification = updateExecutionVerification(
                verification,
                toolCall,
                result,
              );
              toolResultMessages.push(
                buildToolResultMessage(
                  toolCall.function.name,
                  result,
                  toolCall.function.arguments,
                ),
              );
            }

            if (approvalIndex < streamedTurn.toolCalls.length) {
              dispatch({
                type: ChatActionType.RequestToolApproval,
                pendingToolCall: {
                  toolCall: streamedTurn.toolCalls[approvalIndex],
                  messages: [...updatedMessages, ...toolResultMessages],
                  verification,
                },
              });
              return;
            }

            nextMessages = [...updatedMessages, ...toolResultMessages];
            dispatch({
              type: ChatActionType.CommitMessages,
              messages: nextMessages,
            });
          }

          if (!nextMessages) {
            const incompleteResponse = classifyIncompleteResponse(
              assistantMessage.content,
              streamedTurn.hadThinking,
            );
            if (incompleteResponse === 'serialized-tool-call') {
              assistantMessage.content = SERIALIZED_TOOL_CALL_MESSAGE;
            }
            await prewarmCodeBlocks(assistantMessage.content, theme);
            const updatedMessages = commitAssistantMessage();
            const hasToolIntent =
              incompleteResponse === 'serialized-tool-call' ||
              incompleteResponse === 'tool-commitment';

            if (assistantMessage.content) {
              emptyResponseCorrections = 0;
            }

            if (
              assistantMessage.content &&
              reportsVerifiedNoChange(verification, assistantMessage.content)
            ) {
              verification = resolveVerifiedNoChange(verification);
              if (!verification.required) {
                return;
              }
            }

            if (
              verification.failedMutationPending &&
              assistantMessage.content &&
              !reportsVerificationBlocked(assistantMessage.content)
            ) {
              if (failedMutationCorrections < MAX_FAILED_MUTATION_CORRECTIONS) {
                failedMutationCorrections += 1;
                activeMessages = [
                  ...updatedMessages,
                  {
                    role: ROLE.SYSTEM,
                    content: buildFailedMutationCorrection(
                      verification.failedMutationTool,
                    ),
                  },
                ];
                dispatch({
                  type: ChatActionType.CommitMessages,
                  messages: activeMessages,
                });
                continue;
              }

              const mutationError: ollama.Message = {
                role: ROLE.ASSISTANT,
                content:
                  'Error: The model stopped after a failed state change without retrying or reporting a blocker.',
              };
              await prewarmCodeBlocks(mutationError.content, theme);
              dispatch({
                type: ChatActionType.CommitMessages,
                messages: [...updatedMessages, mutationError],
              });
              return;
            }

            if (hasToolIntent) {
              if (toolIntentCorrections < MAX_TOOL_INTENT_CORRECTIONS) {
                toolIntentCorrections += 1;
                activeMessages = [
                  ...updatedMessages,
                  {
                    role: ROLE.SYSTEM,
                    content:
                      verification.failedVerificationCommands.length > 0
                        ? buildVerificationCorrection(
                            verification.remainingCommands,
                            verification.failedVerificationCommands,
                          )
                        : buildIncompleteResponseCorrection(
                            incompleteResponse,
                            toolTurns > 0,
                          ),
                  },
                ];
                dispatch({
                  type: ChatActionType.CommitMessages,
                  messages: activeMessages,
                });
                continue;
              }

              const intentError: ollama.Message = {
                role: ROLE.ASSISTANT,
                content:
                  'Error: The model repeatedly described a tool action without calling it.',
              };
              await prewarmCodeBlocks(intentError.content, theme);
              dispatch({
                type: ChatActionType.CommitMessages,
                messages: [...updatedMessages, intentError],
              });
              return;
            }

            if (
              verification.mutationRequired &&
              !verification.mutationCompleted &&
              assistantMessage.content
            ) {
              if (planExecutionCorrections < MAX_PLAN_EXECUTION_CORRECTIONS) {
                planExecutionCorrections += 1;
                const pendingTargets = getPendingMutationTargets(verification);
                activeMessages = [
                  ...updatedMessages,
                  {
                    role: ROLE.SYSTEM,
                    content: [
                      pendingTargets.length > 0
                        ? `The approved implementation plan still has unresolved change targets: ${pendingTargets.join(', ')}.`
                        : 'The approved implementation plan has not made any project changes.',
                      pendingTargets.length > 0
                        ? 'Call the appropriate state-changing tool now to complete those targets.'
                        : verification.mutationTask
                          ? `Execute this pending change now: ${verification.mutationTask}.`
                          : 'Continue now by calling the next required state-changing tool.',
                      'Do not ask for details that should have been resolved during planning or report completion without executing the plan.',
                    ].join(' '),
                  },
                ];
                dispatch({
                  type: ChatActionType.CommitMessages,
                  messages: activeMessages,
                });
                continue;
              }

              const executionError: ollama.Message = {
                role: ROLE.ASSISTANT,
                content:
                  'Error: The model stopped before completing the changes from the approved plan.',
              };
              await prewarmCodeBlocks(executionError.content, theme);
              dispatch({
                type: ChatActionType.CommitMessages,
                messages: [...updatedMessages, executionError],
              });
              return;
            }

            if (
              verification.required &&
              assistantMessage.content &&
              !reportsVerificationBlocked(assistantMessage.content)
            ) {
              if (verificationCorrections < MAX_VERIFICATION_CORRECTIONS) {
                verificationCorrections += 1;
                activeMessages = [
                  ...updatedMessages,
                  {
                    role: ROLE.SYSTEM,
                    content: buildVerificationCorrection(
                      verification.remainingCommands,
                      verification.failedVerificationCommands,
                    ),
                  },
                ];
                dispatch({
                  type: ChatActionType.CommitMessages,
                  messages: activeMessages,
                });
                continue;
              }

              const verificationError: ollama.Message = {
                role: ROLE.ASSISTANT,
                content:
                  'Error: The model stopped before verifying changes made during this turn.',
              };
              await prewarmCodeBlocks(verificationError.content, theme);
              dispatch({
                type: ChatActionType.CommitMessages,
                messages: [...updatedMessages, verificationError],
              });
              return;
            }

            if (!assistantMessage.content) {
              const missingResponse = incompleteResponse ?? 'empty';
              if (emptyResponseCorrections < MAX_EMPTY_RESPONSE_CORRECTIONS) {
                emptyResponseCorrections += 1;
                activeMessages = [
                  ...updatedMessages,
                  {
                    role: ROLE.SYSTEM,
                    content: buildIncompleteResponseCorrection(
                      missingResponse,
                      toolTurns > 0,
                    ),
                  },
                ];
                dispatch({
                  type: ChatActionType.CommitMessages,
                  messages: activeMessages,
                });
                continue;
              }

              assistantMessage.content =
                missingResponse === 'thinking-only'
                  ? 'Error: The model repeatedly completed reasoning without providing a final response.'
                  : toolTurns > 0
                    ? 'Error: The model stopped before completing the turn after receiving tool results.'
                    : 'Error: The model stopped before completing the turn without producing a response.';
              assistantCommitted = false;
              committedMessages = updatedMessages;
              await prewarmCodeBlocks(assistantMessage.content, theme);
              commitAssistantMessage();
            }

            return;
          }

          toolTurns += 1;
          toolIntentCorrections = 0;
          emptyResponseCorrections = 0;
          verificationCorrections = 0;
          if (!verification.failedMutationPending) {
            failedMutationCorrections = 0;
          }

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
    [abortControllerRef, dispatch, model, mode, onModelCall, theme],
  );

  const runTurnReadOnly = useCallback(
    async (currentMessages: ollama.Message[]) => {
      const modelName = model;

      // v8 ignore next
      if (!modelName) {
        throw new Error('Model is required');
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;
      const ownsTurn = () =>
        abortControllerRef.current === controller && !controller.signal.aborted;
      let activeMessages = currentMessages;
      let incompleteResponseCorrections = 0;
      let terminalToolCorrections = 0;

      try {
        const planTools = await tools.getToolDefinitions({ mode: MODE.PLAN });

        for (let toolTurn = 0; toolTurn < MAX_TOOL_TURNS; toolTurn += 1) {
          const { assistantMessage, hadThinking, toolCalls } =
            await streamAssistantTurn({
              dispatch,
              messages: agents.withSystemMessage([
                ...activeMessages,
                { role: ROLE.SYSTEM, content: PROMPT.PLAN_INSTRUCTION },
              ]),
              model: modelName,
              onModelCall,
              signal: controller.signal,
              toolDefinitions: planTools,
            });

          controller.signal.throwIfAborted();
          if (!ownsTurn()) {
            return;
          }

          dispatch({
            type: ChatActionType.SetStreamingMessage,
            message: null,
          });

          if (toolCalls.length === 0) {
            if (terminalToolCorrections > 0) {
              const errorMessage: ollama.Message = {
                role: ROLE.ASSISTANT,
                content:
                  'Error: The model did not provide a corrected finish_plan_mode call after its invalid proposal.',
              };
              await prewarmCodeBlocks(errorMessage.content, theme);
              dispatch({
                type: ChatActionType.CommitMessages,
                messages: [
                  ...activeMessages,
                  ...(assistantMessage.content ? [assistantMessage] : []),
                  errorMessage,
                ],
              });
              return;
            }

            const incompleteResponse = classifyIncompleteResponse(
              assistantMessage.content,
              hadThinking,
            );
            if (incompleteResponse === null) {
              await prewarmCodeBlocks(assistantMessage.content, theme);
              dispatch({
                type: ChatActionType.CommitMessages,
                messages: [...activeMessages, assistantMessage],
              });
              return;
            }

            const displayedMessage =
              incompleteResponse === 'serialized-tool-call'
                ? {
                    ...assistantMessage,
                    content: SERIALIZED_TOOL_CALL_MESSAGE,
                  }
                : assistantMessage;
            const updatedMessages = [
              ...activeMessages,
              ...(displayedMessage.content ? [displayedMessage] : []),
            ];

            if (
              incompleteResponseCorrections <
              MAX_INCOMPLETE_RESPONSE_CORRECTIONS
            ) {
              incompleteResponseCorrections += 1;
              activeMessages = [
                ...updatedMessages,
                {
                  role: ROLE.SYSTEM,
                  content: buildIncompleteResponseCorrection(
                    incompleteResponse,
                    toolTurn > 0,
                  ),
                },
              ];
              dispatch({
                type: ChatActionType.CommitMessages,
                messages: activeMessages,
              });
              continue;
            }

            const errorMessage: ollama.Message = {
              role: ROLE.ASSISTANT,
              content:
                incompleteResponse === 'empty'
                  ? 'Error: The model repeatedly returned an empty Plan-mode response.'
                  : incompleteResponse === 'thinking-only'
                    ? 'Error: The model repeatedly completed reasoning without providing a final Plan-mode response.'
                    : 'Error: The model repeatedly described a tool action without calling it.',
            };
            await prewarmCodeBlocks(errorMessage.content, theme);
            dispatch({
              type: ChatActionType.CommitMessages,
              messages: [...updatedMessages, errorMessage],
            });
            return;
          }

          const planCalls = toolCalls.filter(
            ({ function: toolFunction }) =>
              toolFunction.name === TOOL.FINISH_PLAN_MODE,
          );
          if (planCalls.length === 1 && toolCalls.length === 1) {
            const validation = validateTerminalToolCall(planCalls[0], (value) =>
              validatePlanProposal(parsePlan(value)),
            );
            if (validation.status === 'recoverable-error') {
              if (terminalToolCorrections < MAX_TERMINAL_TOOL_CORRECTIONS) {
                terminalToolCorrections += 1;
                activeMessages = [
                  ...activeMessages,
                  {
                    role: ROLE.SYSTEM,
                    content: buildTerminalToolCorrection(
                      TOOL.FINISH_PLAN_MODE,
                      validation.error,
                    ),
                  },
                ];
                dispatch({
                  type: ChatActionType.CommitMessages,
                  messages: activeMessages,
                });
                continue;
              }

              const errorMessage: ollama.Message = {
                role: ROLE.ASSISTANT,
                content: `Error: ${TOOL.FINISH_PLAN_MODE} repeatedly returned invalid arguments: ${validation.error}`,
              };
              await prewarmCodeBlocks(errorMessage.content, theme);
              dispatch({
                type: ChatActionType.CommitMessages,
                messages: [...activeMessages, errorMessage],
              });
              return;
            }

            try {
              const plan = validation.value;
              assistantMessage.content = renderPlan(plan);
              await prewarmCodeBlocks(assistantMessage.content, theme);
              const planMessages = [...activeMessages, assistantMessage];
              dispatch({
                type: ChatActionType.CommitMessages,
                messages: planMessages,
              });
              dispatch({
                type: ChatActionType.RequestPlanReview,
                pendingPlan: {
                  plan,
                  planContent: assistantMessage.content,
                  messages: planMessages,
                },
              });
            } catch (error) {
              assistantMessage.content = `Error: Plan proposal could not be prepared: ${error instanceof Error ? error.message : String(error)}`;
              await prewarmCodeBlocks(assistantMessage.content, theme);
              dispatch({
                type: ChatActionType.CommitMessages,
                messages: [...activeMessages, assistantMessage],
              });
            }
            return;
          }

          const researchCalls = toolCalls.filter(
            ({ function: toolFunction }) =>
              toolFunction.name !== TOOL.FINISH_PLAN_MODE,
          );
          const toolResultMessages: ollama.Message[] = [];
          const executableResearchCalls: ollama.ToolCall[] = [];
          for (const toolCall of researchCalls) {
            const toolName = toolCall.function.name;
            if (
              !tools.READ_TOOLS.has(toolName) &&
              !tools.isMcpToolAllowedInMode(toolName, MODE.PLAN)
            ) {
              toolResultMessages.push(buildPlanModeCorrectionMessage(toolName));
            } else {
              executableResearchCalls.push(toolCall);
            }
          }

          const executedResearchCalls = await tools.executeToolCalls(
            executableResearchCalls,
            {
              allowedTools: tools.READ_TOOLS,
              mode: MODE.PLAN,
              signal: controller.signal,
            },
          );
          controller.signal.throwIfAborted();
          if (!ownsTurn()) {
            return;
          }

          for (const { toolCall, result } of executedResearchCalls) {
            toolResultMessages.push(
              buildToolResultMessage(
                toolCall.function.name,
                result,
                toolCall.function.arguments,
              ),
            );
          }
          if (planCalls.length > 0) {
            toolResultMessages.push({
              role: ROLE.SYSTEM,
              content:
                'The plan proposal was ignored because it was batched with other tool calls. After using the tool results, either respond normally or submit the plan as one standalone tool call.',
            });
          }

          activeMessages = [
            ...activeMessages,
            ...(assistantMessage.content ? [assistantMessage] : []),
            ...toolResultMessages,
          ];
          dispatch({
            type: ChatActionType.CommitMessages,
            messages: activeMessages,
          });
          incompleteResponseCorrections = 0;
        }

        const limitMessage: ollama.Message = {
          role: ROLE.ASSISTANT,
          content:
            'Error: Plan-mode research stopped after reaching the tool turn limit.',
        };
        await prewarmCodeBlocks(limitMessage.content, theme);
        dispatch({
          type: ChatActionType.CommitMessages,
          messages: [...activeMessages, limitMessage],
        });
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
        const ownsController = abortControllerRef.current === controller;
        if (ownsController) {
          abortControllerRef.current = null;
          dispatch({
            type: ChatActionType.SetLoading,
            isLoading: false,
          });
        }
      }
    },
    [abortControllerRef, dispatch, model, onModelCall, theme],
  );

  return { runTurn, runTurnReadOnly };
}
