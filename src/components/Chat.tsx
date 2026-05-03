import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import { useState } from 'react';

export function Chat() {
  const [messages, setMessages] = useState<string[]>([]);
  const [input, setInput] = useState('');

  function handleSubmit(value: string) {
    if (value.trim()) {
      setMessages((prev) => [...prev, value.trim()]);
    }
    setInput('');
  }

  return (
    <Box flexDirection="column">
      <Box flexDirection="column">
        {messages.map((message, index) => (
          <Text key={index}>{message}</Text>
        ))}
      </Box>

      <Box>
        <Text>&gt; </Text>
        <TextInput value={input} onChange={setInput} onSubmit={handleSubmit} />
      </Box>
    </Box>
  );
}
