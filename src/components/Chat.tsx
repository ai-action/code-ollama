import { Box } from 'ink';
import { useCallback, useState } from 'react';

import { ROLE, TOOL } from '../constants';
import { ollama, tools } from '../utils';
import { Autocomplete } from './Autocomplete';
import { Messages } from './Messages';
import { ToolApproval } from './ToolApproval';

interface Props {
  model: string;
  onCommand: (command: string) => void;
  autoExecute: boolean;
}

export function Chat({ model, onCommand, autoExecute }: Props) {
  const [messages, setMessages] = useState<ollama.Message[]>([]);
  const [submitKey, setSubmitKey] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingToolCall, setPendingToolCall] =
    useState<ollama.ToolCall | null>(null);

  const processStream = useCallback(
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
              setMessages((previousMessages) => [
                ...previousMessages,
                toolResultMessage,
              ]);

              // Continue conversation with tool result
              await processStream(newMessages);
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
        setMessages((previousMessages) => [
          ...previousMessages,
          toolResultMessage,
        ]);
        await processStream(newMessages);
      } else {
        // Tool was rejected
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
      setMessages((previousMessages) => [...previousMessages, userMessage]);

      const updatedMessages = [...messages, userMessage];
      await processStream(updatedMessages);
    },
    [messages, onCommand, processStream],
  );

  return (
    <Box flexDirection="column">
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
