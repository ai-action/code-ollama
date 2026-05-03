import { Spinner, TextInput } from '@inkjs/ui';
import { Box, Text } from 'ink';
import { useCallback, useState } from 'react';

import { ollama } from '../utils';

export function Chat() {
  const [messages, setMessages] = useState<ollama.Message[]>([]);
  const [submitKey, setSubmitKey] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = useCallback(
    async (value: string) => {
      const userContent = value.trim();
      if (!userContent) return;

      setSubmitKey((key) => key + 1);
      setIsLoading(true);

      const userMessage: ollama.Message = {
        role: 'user',
        content: userContent,
      };
      setMessages((prev) => [...prev, userMessage]);

      const updatedMessages = [...messages, userMessage];
      const assistantMessage: ollama.Message = {
        role: 'assistant',
        content: '',
      };
      setMessages((prev) => [...prev, assistantMessage]);

      try {
        for await (const chunk of ollama.streamChat(updatedMessages)) {
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
    [messages],
  );

  return (
    <Box flexDirection="column">
      <Box flexDirection="column">
        {messages.map((message, index) => (
          <Text key={index} color={message.role === 'user' ? 'green' : 'blue'}>
            {message.role === 'user' ? '> ' : ''}
            {message.content}
          </Text>
        ))}

        {isLoading && messages[messages.length - 1]?.content === '' && (
          <Spinner label="Thinking..." />
        )}
      </Box>

      <Box>
        <Text>&gt; </Text>
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
