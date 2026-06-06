import { render } from 'ink';

import { INK, THEME } from '@/constants';
import { ThemeProvider } from '@/contexts';
import { screen } from '@/utils';

import { DirectoryTrustPrompt } from './DirectoryTrustPrompt';

export async function promptForDirectoryTrust(
  directory: string,
): Promise<boolean> {
  let isTrusted = false;

  screen.reset();

  const app = render(
    <ThemeProvider theme={THEME.getTheme()}>
      <DirectoryTrustPrompt
        directory={directory}
        onDecision={(decision) => {
          isTrusted = decision;
          app.unmount();
        }}
      />
    </ThemeProvider>,
    INK.RENDER_OPTIONS,
  );

  await app.waitUntilExit();

  return isTrusted;
}
