import { Box, Static, Text } from 'ink';
import { useEffect, useState } from 'react';

import { PACKAGE } from '@/constants';
import type { ThemeDefinition } from '@/types';
import { time, update } from '@/utils';

interface Props {
  onLoad: () => void;
  theme: ThemeDefinition;
}

const RELEASES_URL = `https://github.com/ai-action/${PACKAGE.NAME}/releases`;

export function UpdateBanner({ onLoad, theme }: Props) {
  const [latestVersion, setLatestVersion] = useState<string | undefined>();

  useEffect(() => {
    void update
      .checkForUpdate()
      .then(setLatestVersion)
      .finally(async () => {
        await time.tick();
        onLoad();
      });
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
