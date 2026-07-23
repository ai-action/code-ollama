import { useCallback } from 'react';

import { prewarmCodeBlocks } from '@/components/CodeBlock';
import { MODE, PROMPT, ROLE, TOOL } from '@/constants';
import type { Mode, ThemeDefinition, ToolResult } from '@/types';
import { agents, ollama, tools } from '@/utils';

import {
  ACTION_NOT_PERFORMED,
  ChatActionType,
  PLAN_CHECKLIST_REMINDER,
  PLAN_EXECUTION_REMINDER,
} from '../constants';
import {
  isImplementationRequest,
  parsePlan,
  renderPlan,
  validatePlanForRequest,
} from '../plan';
import type { ChatAction } from '../types';
import {
  buildFailedMutationCorrection,
  buildVerificationCorrection,
  createExecutionVerification,
  type ExecutionVerification,
  reportsVerificationBlocked,
  reportsVerifiedNoChange,
  updateExecutionVerification,
} from '../verification';

const MAX_TOOL_TURNS = 25;
const MAX_TOOL_INTENT_CORRECTIONS = 2;
const MAX_EMPTY_RESPONSE_CORRECTIONS = 2;
const MAX_PLAN_SUBMISSION_CORRECTIONS = 1;
const MAX_PLAN_STRUCTURED_CORRECTIONS = 1;
const MAX_PLAN_EXECUTION_CORRECTIONS = 2;
const MAX_FAILED_MUTATION_CORRECTIONS = 2;
const MAX_VERIFICATION_CORRECTIONS = 2;
const STREAMING_UPDATE_INTERVAL_MS = 50;
const SERIALIZED_TOOL_CALL_MESSAGE =
  'The model printed a tool call instead of invoking it.';
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
      result.error && tools.WRITE_TOOLS.has(toolName)
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
      PLAN_CHECKLIST_REMINDER,
      PLAN_EXECUTION_REMINDER,
    ].join('\n'),
  };
}

function buildPlanSubmissionCorrectionMessage(reason: string): ollama.Message {
  return {
    role: ROLE.SYSTEM,
    content: [
      `Plan submission was not accepted: ${reason}`,
      'Call finish_plan_mode now as one standalone tool call',
      'Do not respond with prose or Markdown',
      'Provide outcome, title, and summary plus fields required by that outcome',
      'Ready plans require at least one task',
      'Needs_input plans require exactly one question',
      'Answer is only for informational requests that do not ask for a plan or implementation',
    ].join('\n'),
  };
}

function buildPlanResearchContinuationMessage(reason: string): ollama.Message {
  return {
    role: ROLE.SYSTEM,
    content: [
      `Plan-mode response was incomplete: ${reason}`,
      'If more research is needed, call the next read-only tool now',
      'Otherwise call finish_plan_mode now as one standalone tool call',
      'Do not respond with prose or Markdown',
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

          dispatch({
            type: ChatActionType.SetStreamingMessage,
            message: assistantMessage,
          });
          let nextMessages: ollama.Message[] | null = null;
          let lastStreamingUpdateAt = Date.now();
          let hasRenderedStreamingContent = false;

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
              const now = Date.now();
              if (
                (!hasRenderedStreamingContent ||
                  now - lastStreamingUpdateAt >=
                    STREAMING_UPDATE_INTERVAL_MS) &&
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

            if (approvalIndex < chunk.tool_calls.length) {
              dispatch({
                type: ChatActionType.RequestToolApproval,
                pendingToolCall: {
                  toolCall: chunk.tool_calls[approvalIndex],
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
            break;
          }

          if (!nextMessages) {
            const hasSerializedToolCall = ollama.hasSerializedToolCall(
              assistantMessage.content,
            );
            if (hasSerializedToolCall) {
              assistantMessage.content = SERIALIZED_TOOL_CALL_MESSAGE;
            }
            await prewarmCodeBlocks(assistantMessage.content, theme);
            const updatedMessages = commitAssistantMessage();
            const hasToolIntent =
              hasSerializedToolCall ||
              ollama.hasUncalledToolIntent(assistantMessage.content);

            if (assistantMessage.content) {
              emptyResponseCorrections = 0;
            }

            if (
              assistantMessage.content &&
              reportsVerifiedNoChange(verification, assistantMessage.content)
            ) {
              return;
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
                    content: ollama.TOOL_INTENT_CORRECTION,
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
                activeMessages = [
                  ...updatedMessages,
                  {
                    role: ROLE.SYSTEM,
                    content: [
                      'The approved implementation plan has not made any project changes.',
                      verification.mutationTask
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
                  'Error: The model stopped before making any changes from the approved plan.',
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
              if (emptyResponseCorrections < MAX_EMPTY_RESPONSE_CORRECTIONS) {
                emptyResponseCorrections += 1;
                activeMessages = [
                  ...updatedMessages,
                  {
                    role: ROLE.SYSTEM,
                    content:
                      toolTurns > 0
                        ? 'A tool result was returned but the turn has not been completed. Continue now by calling the next required tool or report the completed outcome.'
                        : 'The response was empty and the turn has not been completed. Continue now by calling the required tool or report the completed outcome.',
                  },
                ];
                dispatch({
                  type: ChatActionType.CommitMessages,
                  messages: activeMessages,
                });
                continue;
              }

              assistantMessage.content =
                toolTurns > 0
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
    async (
      currentMessages: ollama.Message[],
      submissionCorrections = 0,
      submissionOnly = false,
    ) => {
      const modelName = model;

      // v8 ignore next
      if (!modelName) {
        throw new Error('Model is required');
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;
      const ownsTurn = () =>
        abortControllerRef.current === controller && !controller.signal.aborted;

      const assistantMessage: ollama.Message = {
        role: ROLE.ASSISTANT,
        content: '',
      };

      const userRequest = currentMessages.findLast(
        ({ role }) => role === ROLE.USER,
      )?.content;

      const parseSubmittedPlan = (value: unknown) =>
        // v8 ignore start
        validatePlanForRequest(parsePlan(value), userRequest ?? '');
      // v8 ignore stop

      let committedMessages = currentMessages;
      let assistantCommitted = false;

      const commitAssistantMessage = () => {
        // v8 ignore start
        if (!ownsTurn()) {
          return committedMessages;
        }
        // v8 ignore stop

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

      const acceptPlan = async (plan: ReturnType<typeof parsePlan>) => {
        assistantMessage.content = renderPlan(plan);
        await prewarmCodeBlocks(assistantMessage.content, theme);
        controller.signal.throwIfAborted();

        // v8 ignore start
        if (!ownsTurn()) {
          return;
        }
        // v8 ignore stop

        const planMessages = commitAssistantMessage();

        if (plan.outcome === 'ready') {
          dispatch({
            type: ChatActionType.RequestPlanReview,
            pendingPlan: {
              plan,
              planContent: assistantMessage.content,
              messages: planMessages,
            },
          });
        } else if (
          plan.outcome === 'needs_input' &&
          plan.questions[0]?.options.length
        ) {
          dispatch({
            type: ChatActionType.RequestPlanQuestion,
            pendingPlanQuestion: {
              question: plan.questions[0],
              planContent: assistantMessage.content,
              messages: planMessages,
            },
          });
        }
      };

      dispatch({
        type: ChatActionType.SetStreamingMessage,
        message: assistantMessage,
      });

      try {
        const availablePlanTools = await tools.getToolDefinitions({
          mode: MODE.PLAN,
          allowPlanAnswer: !isImplementationRequest(userRequest ?? ''),
        });
        const planTools = submissionOnly
          ? availablePlanTools.filter(
              ({ function: toolFunction }) =>
                toolFunction.name === TOOL.FINISH_PLAN_MODE,
            )
          : availablePlanTools;

        const recoverStructuredPlan = async (
          rejectionReason?: string,
        ): Promise<{ accepted: boolean; reason?: string }> => {
          const finishPlanModeTool = availablePlanTools.find(
            ({ function: toolFunction }) =>
              toolFunction.name === TOOL.FINISH_PLAN_MODE,
          );
          if (!finishPlanModeTool?.function.parameters) {
            return { accepted: false };
          }

          let reason = rejectionReason;
          let recoveryParameters = finishPlanModeTool.function.parameters;
          let recoveryMessages = agents.withSystemMessage([
            ...committedMessages,
            {
              role: ROLE.SYSTEM,
              content: PROMPT.PLAN_STRUCTURED_OUTPUT_INSTRUCTION,
            },
            ...(reason
              ? [
                  {
                    role: ROLE.SYSTEM,
                    content: `The previous plan was rejected: ${reason}\nReturn a corrected JSON object`,
                  } as ollama.Message,
                ]
              : []),
          ]);

          for (
            let correction = 0;
            correction <= MAX_PLAN_STRUCTURED_CORRECTIONS;
            correction += 1
          ) {
            let result: Awaited<
              ReturnType<typeof ollama.generateStructuredChat>
            >;
            try {
              result = await ollama.generateStructuredChat(
                recoveryMessages,
                modelName,
                recoveryParameters,
                controller.signal,
              );
            } catch (error) {
              // v8 ignore start
              if (controller.signal.aborted) {
                throw error;
              }
              // v8 ignore stop

              reason = error instanceof Error ? error.message : String(error);
              return { accepted: false, reason };
            }
            controller.signal.throwIfAborted();
            // v8 ignore start
            if (!ownsTurn()) {
              return { accepted: false };
            }
            // v8 ignore stop

            onModelCall?.(result.stats);

            let submittedValue: unknown;
            try {
              submittedValue = JSON.parse(result.content);
              const plan = parseSubmittedPlan(submittedValue);
              await acceptPlan(plan);
              return { accepted: true };
            } catch (error) {
              reason = error instanceof Error ? error.message : String(error);
              if (correction >= MAX_PLAN_STRUCTURED_CORRECTIONS) {
                break;
              }
              if (
                typeof submittedValue === 'object' &&
                submittedValue !== null &&
                !Array.isArray(submittedValue)
              ) {
                const submittedOutcome = (
                  submittedValue as { outcome?: unknown }
                ).outcome;
                if (
                  submittedOutcome === 'ready' ||
                  submittedOutcome === 'needs_input' ||
                  submittedOutcome === 'answer'
                ) {
                  recoveryParameters = tools.specializeFinishPlanModeParameters(
                    recoveryParameters,
                    submittedOutcome,
                  );
                }
              }
              recoveryMessages = agents.withSystemMessage([
                ...committedMessages,
                {
                  role: ROLE.SYSTEM,
                  content: PROMPT.PLAN_STRUCTURED_OUTPUT_INSTRUCTION,
                },
                { role: ROLE.ASSISTANT, content: result.content },
                {
                  role: ROLE.SYSTEM,
                  content: `The JSON plan was rejected: ${reason}\nReturn a corrected JSON object`,
                },
              ]);
            }
          }

          return { accepted: false, ...(reason ? { reason } : {}) };
        };

        const planResearchMessages: ollama.Message[] = [
          ...currentMessages,
          {
            role: ROLE.SYSTEM,
            content: submissionOnly
              ? PROMPT.PLAN_SUBMISSION_INSTRUCTION
              : PROMPT.PLAN_INSTRUCTION,
          },
        ];
        let lastStreamingUpdateAt = Date.now();
        let hasRenderedStreamingContent = false;

        for await (const chunk of ollama.streamChat(
          agents.withSystemMessage(planResearchMessages),
          modelName,
          planTools,
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
          } else if (chunk.type === 'stats') {
            onModelCall?.(chunk.stats);
            // v8 ignore start
          } else {
            // v8 ignore stop
            if (chunk.tool_calls.length === 0) {
              continue;
            }

            const submissionCalls = chunk.tool_calls.filter(
              ({ function: toolFunction }) =>
                toolFunction.name === TOOL.FINISH_PLAN_MODE,
            );

            if (submissionCalls.length === 1 && chunk.tool_calls.length === 1) {
              try {
                const plan = parseSubmittedPlan(
                  submissionCalls[0]?.function.arguments ?? {},
                );
                await acceptPlan(plan);
                return;
              } catch (error) {
                const reason =
                  error instanceof Error ? error.message : String(error);
                if (submissionCorrections < MAX_PLAN_SUBMISSION_CORRECTIONS) {
                  dispatch({
                    type: ChatActionType.SetStreamingMessage,
                    message: null,
                  });
                  const correctedMessages = [
                    ...committedMessages,
                    buildPlanSubmissionCorrectionMessage(reason),
                  ];
                  dispatch({
                    type: ChatActionType.CommitMessages,
                    messages: correctedMessages,
                  });
                  await runTurnReadOnly(
                    correctedMessages,
                    submissionCorrections + 1,
                    true,
                  );
                  return;
                }

                const recovery = await recoverStructuredPlan(reason);
                if (recovery.accepted) {
                  return;
                }
                assistantMessage.content = `Error: Plan mode could not accept finish_plan_mode: ${recovery.reason ?? reason}`;
                await prewarmCodeBlocks(assistantMessage.content, theme);
                commitAssistantMessage();
                return;
              }
            }

            const researchCalls = chunk.tool_calls.filter(
              ({ function: toolFunction }) =>
                toolFunction.name !== TOOL.FINISH_PLAN_MODE,
            );
            const updatedMessages = commitAssistantMessage();
            const toolResultMessages: ollama.Message[] = [];
            const executableResearchCalls: ollama.ToolCall[] = [];

            for (const toolCall of researchCalls) {
              const toolName = toolCall.function.name;
              if (
                !tools.READ_TOOLS.has(toolName) &&
                !tools.isMcpToolAllowedInMode(toolName, MODE.PLAN)
              ) {
                toolResultMessages.push(
                  buildPlanModeCorrectionMessage(toolName),
                );
                continue;
              }

              executableResearchCalls.push(toolCall);
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
            // v8 ignore start
            if (!ownsTurn()) {
              return;
            }
            // v8 ignore stop

            for (const { toolCall, result } of executedResearchCalls) {
              toolResultMessages.push(
                buildToolResultMessage(
                  toolCall.function.name,
                  result,
                  toolCall.function.arguments,
                ),
              );
            }

            const batchedSubmission = submissionCalls.length > 0;
            const nextMessages = [
              ...updatedMessages,
              ...toolResultMessages,
              ...(batchedSubmission
                ? [
                    buildPlanSubmissionCorrectionMessage(
                      'finish_plan_mode must be the only tool call in its response',
                    ),
                  ]
                : []),
            ];
            dispatch({
              type: ChatActionType.CommitMessages,
              messages: nextMessages,
            });

            if (
              batchedSubmission &&
              submissionCorrections >= MAX_PLAN_SUBMISSION_CORRECTIONS
            ) {
              assistantCommitted = false;
              committedMessages = nextMessages;
              const recovery = await recoverStructuredPlan();
              if (recovery.accepted) {
                return;
              }
              assistantMessage.content = recovery.reason
                ? `Error: Plan mode could not recover finish_plan_mode: ${recovery.reason}`
                : 'Error: Plan mode requires finish_plan_mode as one standalone tool call.';
              await prewarmCodeBlocks(assistantMessage.content, theme);
              commitAssistantMessage();
              return;
            }

            await runTurnReadOnly(
              nextMessages,
              submissionCorrections + (batchedSubmission ? 1 : 0),
              submissionOnly || batchedSubmission,
            );
            return;
          }
        }

        if (submissionCorrections < MAX_PLAN_SUBMISSION_CORRECTIONS) {
          dispatch({
            type: ChatActionType.SetStreamingMessage,
            message: null,
          });
          const correctedMessages = [
            ...committedMessages,
            buildPlanResearchContinuationMessage(
              'the response ended without finish_plan_mode',
            ),
          ];
          dispatch({
            type: ChatActionType.CommitMessages,
            messages: correctedMessages,
          });
          await runTurnReadOnly(correctedMessages, submissionCorrections + 1);
          return;
        }

        const recovery = await recoverStructuredPlan();
        if (recovery.accepted) {
          return;
        }
        assistantMessage.content = recovery.reason
          ? `Error: Plan mode could not recover finish_plan_mode: ${recovery.reason}`
          : 'Error: Plan mode requires a valid standalone finish_plan_mode tool call.';
        await prewarmCodeBlocks(assistantMessage.content, theme);
        commitAssistantMessage();
      } catch (error) {
        // v8 ignore next
        if (!controller.signal.aborted) {
          assistantMessage.content = `Error: ${error instanceof Error ? error.message : String(error)}`;
          await prewarmCodeBlocks(assistantMessage.content, theme);
          commitAssistantMessage();
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
