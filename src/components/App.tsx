import { Box, Text } from 'ink';

import { Chat } from './Chat';

export function App() {
  return (
    <Box flexDirection="column">
      <Text>🦙 code-ollama</Text>
      <Chat />
    </Box>
  );
}
