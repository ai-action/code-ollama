import { homedir } from 'node:os';

import { Box, Text } from 'ink';

import { version } from '../../package.json';
import { UI } from '../constants';

interface Props {
  model: string;
}

function abbreviatePath(dir: string): string {
  const home = homedir();
  return dir.startsWith(home) ? `~${dir.slice(home.length)}` : dir;
}

export function Header({ model }: Props) {
  const directory = abbreviatePath(process.cwd());

  return (
    <Box borderStyle="round" flexDirection="column" paddingX={1}>
      <Text>
        <Text bold>{UI.HEADER_PREFIX}Code Ollama</Text>
        <Text dimColor> (v{version})</Text>
      </Text>

      <Text> </Text>

      <Box>
        <Text dimColor>{'model:'.padEnd(11)}</Text>
        <Text>
          {model}
          {'   '}
        </Text>
        <Text color="cyan">/model</Text>
        <Text dimColor> to switch</Text>
      </Box>

      <Box>
        <Text dimColor>{'directory:'.padEnd(11)}</Text>
        <Text>{directory}</Text>
      </Box>
    </Box>
  );
}
