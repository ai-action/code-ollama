import { homedir } from 'node:os';

import { Box, Static, Text } from 'ink';
import { useEffect } from 'react';

import { PACKAGE, THEME, UI } from '../constants';
import type { ThemeDefinition } from '../types';

interface Props {
  model: string;
  onLoad: () => void;
  theme?: ThemeDefinition;
}

function abbreviatePath(dir: string): string {
  const home = homedir();
  return dir.startsWith(home) ? `~${dir.slice(home.length)}` : dir;
}

export function Header({ model, onLoad, theme = THEME.getTheme() }: Props) {
  const directory = abbreviatePath(process.cwd());

  useEffect(() => {
    onLoad();
  }, []);

  return (
    <Static items={[0]}>
      {(key) => (
        <Box key={key} borderStyle="bold" flexDirection="column" paddingX={1}>
          <Text>
            <Text bold>{UI.HEADER_PREFIX}Code Ollama</Text>
            <Text color={theme.colors.secondary} dimColor>
              {' '}
              (v{PACKAGE.VERSION})
            </Text>
          </Text>

          <Box marginTop={1}>
            <Text color={theme.colors.secondary} dimColor>
              {'model:'.padEnd(11)}
            </Text>
            <Text>{model.padEnd(model.length + 3)}</Text>
            <Text color={theme.colors.command}>/model</Text>
            <Text color={theme.colors.secondary} dimColor>
              {' '}
              to switch
            </Text>
          </Box>

          <Box>
            <Text color={theme.colors.secondary} dimColor>
              {'directory:'.padEnd(11)}
            </Text>
            <Text>{directory}</Text>
          </Box>
        </Box>
      )}
    </Static>
  );
}
