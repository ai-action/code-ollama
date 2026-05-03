import { Box, Text } from 'ink';

import { Chat } from './Chat';

export function App() {
  return (
    <Box flexDirection="column">
      <Text>Code Ollama</Text>
      <Chat />
    </Box>
  );
}
