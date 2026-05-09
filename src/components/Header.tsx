import { homedir } from 'node:os';

import { Box, Static, Text } from 'ink';
import { useEffect } from 'react';

import { PACKAGE, UI } from '../constants';

interface Props {
  model: string;
  onLoad: () => void;
}

function abbreviatePath(dir: string): string {
  const home = homedir();
  return dir.startsWith(home) ? `~${dir.slice(home.length)}` : dir;
}

export function Header({ model, onLoad }: Props) {
  const directory = abbreviatePath(process.cwd());

  useEffect(() => {
    onLoad();
  }, []);

  return (
    <Static items={[0]}>
      {(key) => (
        <Box key={key} borderStyle="round" flexDirection="column" paddingX={1}>
          <Text>
            <Text bold>{UI.HEADER_PREFIX}Code Ollama</Text>
            <Text dimColor> (v{PACKAGE.VERSION})</Text>
          </Text>

          <Box marginTop={1}>
            <Text dimColor>{'model:'.padEnd(11)}</Text>
            <Text>{model.padEnd(model.length + 3)}</Text>
            <Text color="cyan">/model</Text>
            <Text dimColor> to switch</Text>
          </Box>

          <Box>
            <Text dimColor>{'directory:'.padEnd(11)}</Text>
            <Text>{directory}</Text>
          </Box>
        </Box>
      )}
    </Static>
  );
}
