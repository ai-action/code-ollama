import { Box, Text, useInput } from 'ink';
import { useCallback, useState } from 'react';

import { ROLE, TOOL } from '../constants';
import { ollama, tools } from '../utils';
import { Autocomplete } from './Autocomplete';
import { Messages } from './Messages';
import { ToolApproval } from './ToolApproval';

interface Props {
  model: string;
  onCommand: (command: string) => void;
}

export function Chat({ model, onCommand }: Props) {
  const [messages, setMessages] = useState<ollama.Message[]>([]);
  const [submitKey, setSubmitKey] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [autoExecute, setAutoExecute] = useState(false);
  const [pendingToolCall, setPendingToolCall] =
    useState<ollama.ToolCall | null>(null);

  // Keyboard shortcut to toggle auto-execute mode
  useInput((_, key) => {
    if (key.tab && key.shift) {
      setAutoExecute((prev) => !prev);
    }
  });

  const processStream = useCallback(
    async (currentMessages: ollama.Message[]) => {
      const assistantMessage: ollama.Message = {
        role: ROLE.ASSISTANT,
        content: '',
      };
      setMessages((prev) => [...prev, assistantMessage]);

      try {
        for await (const chunk of ollama.streamChat(
          currentMessages,
          model,
          tools.TOOLS,
        )) {
          if (chunk.type === 'content') {
            assistantMessage.content += chunk.content;
            setMessages((prev) => {
              const newMessages = [...prev];
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
              const requiresApproval = tools.TOOLS_REQUIRING_APPROVAL.has(
                toolCall.function.name as
                  | typeof TOOL.NAME.WRITE_FILE
                  | typeof TOOL.NAME.RUN_SHELL,
              );

              if (!autoExecute && requiresApproval) {
                // Pause for approval
                setPendingToolCall(toolCall);
                setIsLoading(false);
                return;
              }

              // Execute tool
              const result = await tools.executeTool(
                toolCall.function.name,
                toolCall.function.arguments,
              );

              // Add tool result as system message
              const toolResultMessage: ollama.Message = {
                role: ROLE.SYSTEM,
                content: `Tool ${toolCall.function.name} result:\n${result.content}${result.error ? `\nError: ${result.error}` : ''}`,
              };

              const newMessages = [
                ...currentMessages,
                assistantMessage,
                toolResultMessage,
              ];
              setMessages((prev) => [...prev, toolResultMessage]);

              // Continue conversation with tool result
              await processStream(newMessages);
              return;
            }
          }
        }
      } catch (error) {
        assistantMessage.content = `Error: ${error instanceof Error ? error.message : String(error)}`;
        setMessages((prev) => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1] = { ...assistantMessage };
          return newMessages;
        });
      } finally {
        setIsLoading(false);
      }
    },
    [model, autoExecute],
  );

  const handleToolApproval = useCallback(
    async (approved: boolean) => {
      // v8 ignore next
      if (!pendingToolCall) {
        return;
      }

      const toolCall = pendingToolCall;
      setPendingToolCall(null);
      setIsLoading(true);

      if (approved) {
        const result = await tools.executeTool(
          toolCall.function.name,
          toolCall.function.arguments,
        );

        const toolResultMessage: ollama.Message = {
          role: ROLE.SYSTEM,
          content: `Tool ${toolCall.function.name} result:\n${result.content}${result.error ? `\nError: ${result.error}` : ''}`,
        };

        const newMessages = [...messages, toolResultMessage];
        setMessages((prev) => [...prev, toolResultMessage]);
        await processStream(newMessages);
      } else {
        // Tool was rejected
        const rejectionMessage: ollama.Message = {
          role: ROLE.SYSTEM,
          content: `User declined to execute tool ${toolCall.function.name}`,
        };
        const newMessages = [...messages, rejectionMessage];
        setMessages((prev) => [...prev, rejectionMessage]);
        await processStream(newMessages);
      }
    },
    [pendingToolCall, messages, processStream],
  );

  const handleSubmit = useCallback(
    async (value: string) => {
      const userContent = value.trim();
      if (!userContent) return;

      setSubmitKey((key) => key + 1);

      if (userContent.startsWith('/')) {
        onCommand(userContent);
        return;
      }

      setIsLoading(true);

      const userMessage: ollama.Message = {
        role: ROLE.USER,
        content: userContent,
      };
      setMessages((prev) => [...prev, userMessage]);

      const updatedMessages = [...messages, userMessage];
      await processStream(updatedMessages);
    },
    [messages, onCommand, processStream],
  );

  return (
    <Box flexDirection="column">
      <Box justifyContent="space-between">
        <Text dimColor>
          Mode: {autoExecute ? 'Auto' : 'Safe'} (Shift+Tab to toggle)
        </Text>
      </Box>

      <Messages messages={messages} isLoading={isLoading} />

      {pendingToolCall && (
        <ToolApproval
          toolCall={pendingToolCall}
          onApprove={() => void handleToolApproval(true)}
          onReject={() => void handleToolApproval(false)}
        />
      )}

      {!pendingToolCall && (
        <Autocomplete
          key={submitKey}
          isDisabled={isLoading}
          onSubmit={(val) => {
            void handleSubmit(val);
          }}
        />
      )}
    </Box>
  );
}
