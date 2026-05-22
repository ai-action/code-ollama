import { Box, Static, Text } from 'ink';

import { PACKAGE, THEME } from '@/constants';
import type { ThemeDefinition } from '@/types';

interface Props {
  currentVersion: string;
  latestVersion: string;
  theme?: ThemeDefinition;
}

const RELEASES_URL = `https://github.com/ai-action/${PACKAGE.NAME}/releases`;

export function UpdateBanner({
  currentVersion,
  latestVersion,
  theme = THEME.getTheme(),
}: Props) {
  return (
    <Static items={[0]}>
      {(key) => (
        <Box key={key} borderStyle="round" flexDirection="column" paddingX={1}>
          <Text>
            {'🚀 Update available! '}
            <Text color={theme.colors.secondary} dimColor>
              {currentVersion}
            </Text>
            {' → '}
            <Text color={theme.colors.accent}>{latestVersion}</Text>
          </Text>
          <Text>
            {'Run to update: '}
            <Text color={theme.colors.command}>npm i -g {PACKAGE.NAME}</Text>
          </Text>
          <Text> </Text>
          <Text>See release notes:</Text>
          <Text color={theme.colors.secondary}>{RELEASES_URL}</Text>
        </Box>
      )}
    </Static>
  );
}
