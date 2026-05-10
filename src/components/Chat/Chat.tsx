import { Box, Text } from 'ink';
import { useCallback, useEffect, useRef, useState } from 'react';

import { DECISION, MODE, PROMPT, ROLE } from '../../constants';
import type { Decision, Mode, ToolName, ToolResult } from '../../types';
import { agents, ollama, tools } from '../../utils';
import { prewarmCodeBlocks } from '../CodeBlock';
import { Messages } from '../Messages';
import { TURN_ABORTED_MESSAGE } from '../Messages/constants';
import { PlanApproval } from '../PlanApproval';
import { ToolApproval } from '../ToolApproval';
import {
  ACTION_NOT_PERFORMED,
  INTERRUPT_REASON,
  PLAN_CHECKLIST_REMINDER,
  PLAN_EXECUTION_REMINDER,
} from './constants';
import { Input } from './Input';
import { hasExecutablePlan } from './plan';

interface Props {
  model: string;
  onCommand: (command: string) => void;
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  sessionId: number;
}

export function Chat({
  model,
  onCommand,
  mode,
  onModeChange,
  sessionId,
}: Props) {
  const [messages, setMessages] = useState<ollama.Message[]>([]);
  const [streamingMessage, setStreamingMessage] =
    useState<ollama.Message | null>(null);

  const [isLoading, setIsLoading] = useState(false);

  const [pendingToolCall, setPendingToolCall] =
    useState<ollama.ToolCall | null>(null);
  const [pendingPlan, setPendingPlan] = useState<{
    planContent: string;
    messages: ollama.Message[];
  } | null>(null);

  const [interruptReason, setInterruptReason] =
    useState<INTERRUPT_REASON | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setMessages([]);
    setStreamingMessage(null);
    setIsLoading(false);
    setPendingToolCall(null);
    setPendingPlan(null);
    setInterruptReason(null);
  }, [sessionId]);

  const buildToolResultMessage = useCallback(
    (toolName: string, result: ToolResult): ollama.Message => {
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
        content: `Tool ${toolName} result:\n${result.content}${result.error ? `\nError: ${result.error}` : ''}`,
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
    setIsLoading(false);
    setStreamingMessage(null);
    setInterruptReason(INTERRUPT_REASON.INTERRUPTED);
    setMessages((prev) => [
      ...prev,
      { role: ROLE.USER, content: TURN_ABORTED_MESSAGE },
    ]);
  }, []);

  const processStream = useCallback(
    async (currentMessages: ollama.Message[], executionMode: Mode = mode) => {
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const assistantMessage: ollama.Message = {
        role: ROLE.ASSISTANT,
        content: '',
      };
      let committedMessages = currentMessages;
      let assistantCommitted = false;

      const commitAssistantMessage = () => {
        if (assistantCommitted) {
          // v8 ignore next
          if (committedMessages.at(-1)?.role === ROLE.ASSISTANT) {
            committedMessages = [
              ...committedMessages.slice(0, -1),
              { ...assistantMessage },
            ];
            setMessages(committedMessages);
          }
          return committedMessages;
        }

        assistantCommitted = true;
        setStreamingMessage(null);

        if (!assistantMessage.content) {
          setMessages(committedMessages);
          return committedMessages;
        }

        committedMessages = [...committedMessages, { ...assistantMessage }];
        setMessages(committedMessages);
        return committedMessages;
      };

      setStreamingMessage(assistantMessage);

      try {
        for await (const chunk of ollama.streamChat(
          agents.withSystemMessage(currentMessages),
          model,
          tools.TOOLS,
          controller.signal,
        )) {
          // v8 ignore next 3
          if (controller.signal.aborted) {
            return;
          }
          if (chunk.type === 'content') {
            assistantMessage.content += chunk.content;
            setStreamingMessage({ ...assistantMessage });
            // v8 ignore start
          } else if (
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            chunk.type === 'tool_calls'
            // v8 ignore stop
          ) {
            // Handle tool calls
            for (const toolCall of chunk.tool_calls) {
              const requiresApproval = tools.WRITE_TOOLS.has(
                toolCall.function.name,
              );
              // v8 ignore start
              const allowedTools =
                executionMode === MODE.PLAN ? tools.READ_TOOLS : undefined;
              // v8 ignore stop
              const updatedMessages = commitAssistantMessage();

              if (executionMode === MODE.SAFE && requiresApproval) {
                // Pause for approval
                setPendingToolCall(toolCall);
                setIsLoading(false);
                return;
              }

              // Execute tool
              const result = await tools.executeTool(
                toolCall.function.name as ToolName,
                toolCall.function.arguments,
                { allowedTools },
              );

              const toolResultMessage = buildToolResultMessage(
                toolCall.function.name,
                result,
              );

              const newMessages = [...updatedMessages, toolResultMessage];
              setMessages(newMessages);

              // Continue conversation with tool result
              await processStream(newMessages, executionMode);
              return;
            }
          }
        }

        await prewarmCodeBlocks(assistantMessage.content);
        commitAssistantMessage();
      } catch (error) {
        // v8 ignore next
        if (!controller.signal.aborted) {
          assistantMessage.content = `Error: ${error instanceof Error ? error.message : String(error)}`;
          await prewarmCodeBlocks(assistantMessage.content);
          commitAssistantMessage();
        }
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
        setIsLoading(false);
      }
    },
    [buildToolResultMessage, model, mode],
  );

  // Process stream with only read-only tools (for plan mode research phase)
  const processStreamReadOnly = useCallback(
    async (currentMessages: ollama.Message[]) => {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const assistantMessage: ollama.Message = {
        role: ROLE.ASSISTANT,
        content: '',
      };

      let committedMessages = currentMessages;
      let assistantCommitted = false;

      const commitAssistantMessage = () => {
        if (assistantCommitted) {
          // v8 ignore next
          if (committedMessages.at(-1)?.role === ROLE.ASSISTANT) {
            committedMessages = [
              ...committedMessages.slice(0, -1),
              { ...assistantMessage },
            ];
            setMessages(committedMessages);
          }
          return committedMessages;
        }

        assistantCommitted = true;
        setStreamingMessage(null);

        if (!assistantMessage.content) {
          setMessages(committedMessages);
          return committedMessages;
        }

        committedMessages = [...committedMessages, { ...assistantMessage }];
        setMessages(committedMessages);
        return committedMessages;
      };

      setStreamingMessage(assistantMessage);

      try {
        // Filter to only read-only tools during research phase
        const readOnlyTools = tools.TOOLS.filter((tool) =>
          tools.READ_TOOLS.has(tool.function.name),
        );

        for await (const chunk of ollama.streamChat(
          agents.withSystemMessage(currentMessages),
          model,
          readOnlyTools,
          controller.signal,
        )) {
          // v8 ignore next 3
          if (controller.signal.aborted) {
            return;
          }
          if (chunk.type === 'content') {
            assistantMessage.content += chunk.content;
            setStreamingMessage({ ...assistantMessage });
            // v8 ignore start
          } else if (
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            chunk.type === 'tool_calls'
            // v8 ignore stop
          ) {
            // Execute read-only tools immediately during research
            for (const toolCall of chunk.tool_calls) {
              const updatedMessages = commitAssistantMessage();

              if (!tools.READ_TOOLS.has(toolCall.function.name)) {
                const correctionMessage = buildPlanModeCorrectionMessage(
                  toolCall.function.name,
                );

                const newMessages = [...updatedMessages, correctionMessage];
                setMessages(newMessages);

                await processStreamReadOnly(newMessages);
                return;
              }

              const result = await tools.executeTool(
                toolCall.function.name as ToolName,
                toolCall.function.arguments,
                { allowedTools: tools.READ_TOOLS },
              );

              const toolResultMessage = buildToolResultMessage(
                toolCall.function.name,
                result,
              );

              const newMessages = [...updatedMessages, toolResultMessage];
              setMessages(newMessages);

              // Continue with read-only stream
              await processStreamReadOnly(newMessages);
              return;
            }
          }
        }

        await prewarmCodeBlocks(assistantMessage.content);
        const researchMessages = commitAssistantMessage();

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
        setStreamingMessage(planAssistantMessage);

        try {
          // Stream plan generation (no tools, just text output)
          for await (const chunk of ollama.streamChat(
            agents.withSystemMessage(planMessages),
            model,
            [], // No tools during plan generation output
            controller.signal,
          )) {
            // v8 ignore next 3
            if (controller.signal.aborted) {
              return;
            }
            if (chunk.type === 'content') {
              planAssistantMessage.content += chunk.content;
              setStreamingMessage({ ...planAssistantMessage });
            }
          }
        } catch (error) {
          // v8 ignore next
          planAssistantMessage.content = `Error: ${error instanceof Error ? error.message : String(error)}`;
          const errorPlanMessages = [
            ...planMessages,
            { ...planAssistantMessage },
          ];
          setMessages(errorPlanMessages);
          setStreamingMessage(null);
          setIsLoading(false);
          return;
        }

        const finalPlanMessages = [
          ...planMessages,
          { ...planAssistantMessage },
        ];
        setMessages(finalPlanMessages);
        setStreamingMessage(null);

        // Store pending plan for approval
        if (hasExecutablePlan(planAssistantMessage.content)) {
          setPendingPlan({
            planContent: planAssistantMessage.content,
            messages: finalPlanMessages,
          });
        }
        setIsLoading(false);
      } catch (error) {
        // v8 ignore next
        if (!controller.signal.aborted) {
          assistantMessage.content = `Error: ${error instanceof Error ? error.message : String(error)}`;
          await prewarmCodeBlocks(assistantMessage.content);
          commitAssistantMessage();
        }
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
        setIsLoading(false);
      }
    },
    [buildPlanModeCorrectionMessage, buildToolResultMessage, model],
  );

  const handlePlanApproval = useCallback(
    async (mode: Mode) => {
      // v8 ignore next
      if (!pendingPlan) {
        return;
      }

      const { messages: planMessages } = pendingPlan;
      setPendingPlan(null);

      if (mode === MODE.PLAN) {
        onModeChange(MODE.PLAN);
        const cancelMessage: ollama.Message = {
          role: ROLE.SYSTEM,
          content: 'Continuing in Plan mode. No tools were executed.',
        };
        setMessages((previousMessages) => [...previousMessages, cancelMessage]);
        return;
      }

      const selectedMode = mode === MODE.AUTO ? MODE.AUTO : MODE.SAFE;
      onModeChange(selectedMode);
      setIsLoading(true);

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

      const toolCall = pendingToolCall;
      setPendingToolCall(null);
      setIsLoading(true);

      switch (decision) {
        case DECISION.APPROVE: {
          const result = await tools.executeTool(
            toolCall.function.name as ToolName,
            toolCall.function.arguments,
          );

          const toolResultMessage: ollama.Message = {
            role: ROLE.SYSTEM,
            content: `Tool ${toolCall.function.name} result:\n${result.content}${result.error ? `\nError: ${result.error}` : ''}`,
          };

          const newMessages = [...messages, toolResultMessage];
          setMessages((previousMessages) => [
            ...previousMessages,
            toolResultMessage,
          ]);

          await processStream(newMessages);
          break;
        }

        case DECISION.REJECT: {
          setMessages((previousMessages) => [
            ...previousMessages,
            { role: ROLE.USER, content: TURN_ABORTED_MESSAGE },
          ]);
          setIsLoading(false);
          setInterruptReason(INTERRUPT_REASON.REJECTED);
          break;
        }
      }
    },
    [pendingToolCall, messages, processStream],
  );

  const handleSubmit = useCallback(
    async (value: string) => {
      setInterruptReason(null);
      const userContent = value.trim();

      if (!userContent) {
        return;
      }

      if (userContent.startsWith('/')) {
        onCommand(userContent);
        return;
      }

      setIsLoading(true);

      const userMessage: ollama.Message = {
        role: ROLE.USER,
        content: userContent,
      };

      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);

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
      />

      {pendingPlan && (
        <PlanApproval
          planContent={pendingPlan.planContent}
          // eslint-disable-next-line @typescript-eslint/no-misused-promises
          onModeChange={handlePlanApproval}
        />
      )}

      {!pendingPlan && pendingToolCall && (
        <ToolApproval
          toolCall={pendingToolCall}
          // eslint-disable-next-line @typescript-eslint/no-misused-promises
          onDecision={handleToolApproval}
        />
      )}

      {interruptReason && !isLoading && (
        <Box marginBottom={1}>
          <Text color="red">
            {interruptReason === INTERRUPT_REASON.REJECTED
              ? '❗ Tool call rejected.'
              : '❗ Execution interrupted.'}
          </Text>
        </Box>
      )}

      {!pendingPlan && !pendingToolCall && (
        <Box marginTop={1}>
          <Input
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
