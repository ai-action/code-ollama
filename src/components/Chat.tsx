import { Spinner, TextInput } from '@inkjs/ui';
import { Box, Text } from 'ink';
import { useCallback, useState } from 'react';

import { ROLE } from '../constants';
import { ollama } from '../utils';

const PROMPT_PREFIX = '> ';

interface Props {
  model: string;
  onCommand: (command: string) => void;
}

export function Chat({ model, onCommand }: Props) {
  const [messages, setMessages] = useState<ollama.Message[]>([]);
  const [submitKey, setSubmitKey] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

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
      const assistantMessage: ollama.Message = {
        role: ROLE.ASSISTANT,
        content: '',
      };
      setMessages((prev) => [...prev, assistantMessage]);

      try {
        for await (const chunk of ollama.streamChat(updatedMessages, model)) {
          assistantMessage.content += chunk;
          setMessages((prev) => {
            const newMessages = [...prev];
            newMessages[newMessages.length - 1] = { ...assistantMessage };
            return newMessages;
          });
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
    [messages, model, onCommand],
  );

  return (
    <Box flexDirection="column">
      <Box flexDirection="column">
        {messages.map((message, index) => (
          <Text
            key={index}
            color={message.role === ROLE.USER ? 'green' : 'blue'}
          >
            {message.role === ROLE.USER ? PROMPT_PREFIX : ''}
            {message.content}
          </Text>
        ))}

        {isLoading && messages[messages.length - 1]?.content === '' && (
          <Spinner label="Thinking..." />
        )}
      </Box>

      <Box>
        <Text>{PROMPT_PREFIX}</Text>
        <TextInput
          key={submitKey}
          defaultValue=""
          onSubmit={(value) => {
            void handleSubmit(value);
          }}
          isDisabled={isLoading}
        />
      </Box>
    </Box>
  );
}
