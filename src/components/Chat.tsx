import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import { useCallback, useState } from 'react';

import { ollama } from '../utils';

export function Chat() {
  const [messages, setMessages] = useState<ollama.Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = useCallback(
    async (value: string) => {
      const userContent = value.trim();
      if (!userContent) return;

      setInput('');
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
          <Text color="yellow">...</Text>
        )}
      </Box>

      <Box>
        <Text>&gt; </Text>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={(value) => {
            void handleSubmit(value);
          }}
          focus={!isLoading}
        />
      </Box>
    </Box>
  );
}
