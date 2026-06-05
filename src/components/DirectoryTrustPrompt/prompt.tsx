import { render } from 'ink';

import { screen } from '@/utils';

import { DirectoryTrustPrompt } from './DirectoryTrustPrompt';

export async function promptForDirectoryTrust(
  directory: string,
): Promise<boolean> {
  let isTrusted = false;

  screen.reset();

  const app = render(
    <DirectoryTrustPrompt
      directory={directory}
      onDecision={(decision) => {
        isTrusted = decision;
        app.unmount();
      }}
    />,
    {
      exitOnCtrlC: false,
      maxFps: 60,
    },
  );

  await app.waitUntilExit();

  return isTrusted;
}
