import { Box, Static, Text } from 'ink';
import { useEffect, useState } from 'react';

import { PACKAGE, THEME } from '@/constants';
import type { ThemeDefinition } from '@/types';
import { update } from '@/utils';

interface Props {
  theme?: ThemeDefinition;
}

const RELEASES_URL = `https://github.com/ai-action/${PACKAGE.NAME}/releases`;

export function UpdateBanner({ theme = THEME.getTheme() }: Props) {
  const [latestVersion, setLatestVersion] = useState<string | undefined>();

  useEffect(() => {
    void update.checkForUpdate().then(setLatestVersion);
  }, []);

  if (!latestVersion) {
    return null;
  }

  return (
    <Static items={[0]}>
      {(key) => (
        <Box key={key} borderStyle="bold" flexDirection="column" paddingX={1}>
          <Text>
            <Text italic>🚀 Update available! </Text>
            <Text color={theme.colors.secondary}>{PACKAGE.VERSION}</Text> →{' '}
            <Text color={theme.colors.secondary}>{latestVersion}</Text>
          </Text>

          <Box marginBottom={1}>
            <Text>
              Run to update:{' '}
              <Text color={theme.colors.command}>npm i -g {PACKAGE.NAME}</Text>
            </Text>
          </Box>

          <Text>See release notes:</Text>
          <Text color={theme.colors.accent} dimColor underline>
            {RELEASES_URL}
          </Text>
        </Box>
      )}
    </Static>
  );
}
