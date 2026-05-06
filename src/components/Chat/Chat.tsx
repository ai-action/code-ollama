import { Box } from 'ink';
import { useCallback, useState } from 'react';

import { DECISION, MODE, PROMPT, ROLE } from '../../constants';
import { agents, ollama, tools } from '../../utils';
import { Messages } from '../Messages';
import { PlanApproval } from '../PlanApproval';
import { ToolApproval } from '../ToolApproval';
import {
  ACTION_NOT_PERFORMED,
  PLAN_CHECKLIST_REMINDER,
  PLAN_EXECUTION_REMINDER,
} from './constants';
import { Input } from './Input';
import { hasExecutablePlan } from './plan';

interface Props {
  model: string;
  onCommand: (command: string) => void;
  mode: MODE.Name;
  onModeChange: (mode: MODE.Name) => void;
}

export function Chat({ model, onCommand, mode, onModeChange }: Props) {
  const [messages, setMessages] = useState<ollama.Message[]>([
    agents.createSystemMessage(),
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingToolCall, setPendingToolCall] =
    useState<ollama.ToolCall | null>(null);
  const [pendingPlan, setPendingPlan] = useState<{
    planContent: string;
    messages: ollama.Message[];
  } | null>(null);

  const buildToolResultMessage = useCallback(
    (toolName: string, result: tools.ToolExecutionResult): ollama.Message => {
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

  const processStream = useCallback(
    async (
      currentMessages: ollama.Message[],
      executionMode: MODE.Name = mode,
    ) => {
      const assistantMessage: ollama.Message = {
        role: ROLE.ASSISTANT,
        content: '',
      };

      setMessages((previousMessages) => [
        ...previousMessages,
        assistantMessage,
      ]);

      try {
        for await (const chunk of ollama.streamChat(
          currentMessages,
          model,
          tools.TOOLS,
        )) {
          if (chunk.type === 'content') {
            assistantMessage.content += chunk.content;
            setMessages((previousMessages) => {
              const newMessages = [...previousMessages];
              newMessages[newMessages.length - 1] = { ...assistantMessage };
              return newMessages;
            });
          } else if (
            // v8 ignore start
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            chunk.type === 'tool_calls'
            // v8 ignore stop
          ) {
            // Handle tool calls
            for (const toolCall of chunk.tool_calls) {
              const requiresApproval = tools.DANGEROUS_TOOLS.has(
                toolCall.function.name,
              );
              // v8 ignore start
              const allowedTools =
                executionMode === MODE.NAME.PLAN
                  ? tools.READ_ONLY_TOOLS
                  : undefined;
              // v8 ignore stop

              if (executionMode === MODE.NAME.SAFE && requiresApproval) {
                // Pause for approval
                setPendingToolCall(toolCall);
                setIsLoading(false);
                return;
              }

              // Execute tool
              const result = await tools.executeTool(
                toolCall.function.name,
                toolCall.function.arguments,
                { allowedTools },
              );

              const toolResultMessage = buildToolResultMessage(
                toolCall.function.name,
                result,
              );

              const newMessages = [
                ...currentMessages,
                assistantMessage,
                toolResultMessage,
              ];
              setMessages((previousMessages) => [
                ...previousMessages,
                toolResultMessage,
              ]);

              // Continue conversation with tool result
              await processStream(newMessages, executionMode);
              return;
            }
          }
        }
      } catch (error) {
        assistantMessage.content = `Error: ${error instanceof Error ? error.message : String(error)}`;
        setMessages((previousMessages) => {
          const newMessages = [...previousMessages];
          newMessages[newMessages.length - 1] = { ...assistantMessage };
          return newMessages;
        });
      } finally {
        setIsLoading(false);
      }
    },
    [buildToolResultMessage, model, mode],
  );

  // Process stream with only read-only tools (for plan mode research phase)
  const processStreamReadOnly = useCallback(
    async (currentMessages: ollama.Message[]) => {
      const assistantMessage: ollama.Message = {
        role: ROLE.ASSISTANT,
        content: '',
      };
      setMessages((previousMessages) => [
        ...previousMessages,
        assistantMessage,
      ]);

      try {
        // Filter to only read-only tools during research phase
        const readOnlyTools = tools.TOOLS.filter((tool) =>
          tools.READ_ONLY_TOOLS.has(tool.function.name),
        );

        for await (const chunk of ollama.streamChat(
          currentMessages,
          model,
          readOnlyTools,
        )) {
          if (chunk.type === 'content') {
            assistantMessage.content += chunk.content;
            setMessages((previousMessages) => {
              const newMessages = [...previousMessages];
              newMessages[newMessages.length - 1] = { ...assistantMessage };
              return newMessages;
            });
          } else if (
            // v8 ignore start
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            chunk.type === 'tool_calls'
            // v8 ignore stop
          ) {
            // Execute read-only tools immediately during research
            for (const toolCall of chunk.tool_calls) {
              if (!tools.READ_ONLY_TOOLS.has(toolCall.function.name)) {
                const correctionMessage = buildPlanModeCorrectionMessage(
                  toolCall.function.name,
                );

                const newMessages = [
                  ...currentMessages,
                  assistantMessage,
                  correctionMessage,
                ];
                setMessages((previousMessages) => [
                  ...previousMessages,
                  correctionMessage,
                ]);

                await processStreamReadOnly(newMessages);
                return;
              }

              const result = await tools.executeTool(
                toolCall.function.name,
                toolCall.function.arguments,
                { allowedTools: tools.READ_ONLY_TOOLS },
              );

              const toolResultMessage = buildToolResultMessage(
                toolCall.function.name,
                result,
              );

              const newMessages = [
                ...currentMessages,
                assistantMessage,
                toolResultMessage,
              ];
              setMessages((previousMessages) => [
                ...previousMessages,
                toolResultMessage,
              ]);

              // Continue with read-only stream
              await processStreamReadOnly(newMessages);
              return;
            }
          }
        }

        // Research phase complete - now generate plan with write tools
        // Add instruction to create a plan
        const planInstruction: ollama.Message = {
          role: ROLE.SYSTEM,
          content: PROMPT.PLAN_GENERATION_INSTRUCTION,
        };

        const planMessages = [
          ...currentMessages,
          assistantMessage,
          planInstruction,
        ];

        // Generate the plan
        const planAssistantMessage: ollama.Message = {
          role: ROLE.ASSISTANT,
          content: '',
        };
        setMessages((previousMessages) => [
          ...previousMessages,
          planAssistantMessage,
        ]);

        // Stream plan generation (no tools, just text output)
        for await (const chunk of ollama.streamChat(
          planMessages,
          model,
          [], // No tools during plan generation output
        )) {
          if (chunk.type === 'content') {
            planAssistantMessage.content += chunk.content;
            setMessages((previousMessages) => {
              const newMessages = [...previousMessages];
              newMessages[newMessages.length - 1] = { ...planAssistantMessage };
              return newMessages;
            });
          }
        }

        // Store pending plan for approval
        if (hasExecutablePlan(planAssistantMessage.content)) {
          setPendingPlan({
            planContent: planAssistantMessage.content,
            messages: [...planMessages, planAssistantMessage],
          });
        }
        setIsLoading(false);
      } catch (error) {
        assistantMessage.content = `Error: ${error instanceof Error ? error.message : String(error)}`;
        setMessages((previousMessages) => {
          const newMessages = [...previousMessages];
          newMessages[newMessages.length - 1] = { ...assistantMessage };
          return newMessages;
        });
      } finally {
        setIsLoading(false);
      }
    },
    [buildPlanModeCorrectionMessage, buildToolResultMessage, model],
  );

  const handlePlanApproval = useCallback(
    async (choice: MODE.Name) => {
      // v8 ignore next
      if (!pendingPlan) {
        return;
      }

      const { messages: planMessages } = pendingPlan;
      setPendingPlan(null);

      if (choice === MODE.NAME.PLAN) {
        onModeChange(MODE.NAME.PLAN);
        const cancelMessage: ollama.Message = {
          role: ROLE.SYSTEM,
          content: 'Continuing in Plan mode. No tools were executed.',
        };
        setMessages((previousMessages) => [...previousMessages, cancelMessage]);
        return;
      }

      const selectedMode =
        choice === MODE.NAME.AUTO ? MODE.NAME.AUTO : MODE.NAME.SAFE;
      onModeChange(selectedMode);
      setIsLoading(true);

      // Add instruction to execute the plan
      const executeInstruction: ollama.Message = {
        role: ROLE.SYSTEM,
        content:
          choice === MODE.NAME.AUTO
            ? 'Execute the plan above. Use tools as needed without asking for further confirmation.'
            : 'Execute the plan above one step at a time. Wait for user approval before each tool call that modifies files or runs commands.',
      };

      const executeMessages = [...planMessages, executeInstruction];

      await processStream(executeMessages, selectedMode);
    },
    [onModeChange, pendingPlan, processStream],
  );

  const handleToolApproval = useCallback(
    async (decision: DECISION.Decision) => {
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
            toolCall.function.name,
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
          const rejectionMessage: ollama.Message = {
            role: ROLE.SYSTEM,
            content: `User declined to execute tool ${toolCall.function.name}`,
          };

          const newMessages = [...messages, rejectionMessage];
          setMessages((previousMessages) => [
            ...previousMessages,
            rejectionMessage,
          ]);

          await processStream(newMessages);
          break;
        }
      }
    },
    [pendingToolCall, messages, processStream],
  );

  const handleSubmit = useCallback(
    async (value: string) => {
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
      setMessages((previousMessages) => [...previousMessages, userMessage]);

      const updatedMessages = [...messages, userMessage];

      // Use plan mode stream if in plan mode, otherwise normal stream
      if (mode === MODE.NAME.PLAN) {
        await processStreamReadOnly(updatedMessages);
      } else {
        await processStream(updatedMessages);
      }
    },
    [messages, onCommand, processStream, processStreamReadOnly, mode],
  );

  return (
    <Box flexDirection="column">
      {/* exclude system message from display */}
      <Messages messages={messages.slice(1)} isLoading={isLoading} />

      {pendingPlan && (
        <PlanApproval
          planContent={pendingPlan.planContent}
          onModeChange={(selectedMode) => void handlePlanApproval(selectedMode)}
        />
      )}

      {!pendingPlan && pendingToolCall && (
        <ToolApproval
          toolCall={pendingToolCall}
          // eslint-disable-next-line @typescript-eslint/no-misused-promises
          onDecision={handleToolApproval}
        />
      )}

      {!pendingPlan && !pendingToolCall && (
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        <Input isDisabled={isLoading} onSubmit={handleSubmit} />
      )}
    </Box>
  );
}
