import { render } from 'ink';

import { App } from './components';
import { INK } from './constants';
import type { Screen } from './types';
import { screen } from './utils';

export interface LaunchOptions {
  sessionId?: string;
  initialScreen?: Screen;
}

export function renderApp(options: LaunchOptions = {}): void {
  let resetKey = 0;

  const app = render(
    <App
      key={resetKey}
      sessionId={options.sessionId}
      initialScreen={options.initialScreen}
    />,
    INK.RENDER_OPTIONS,
  );

  screen.setClearHandler((nextSessionId) => {
    screen.reset();
    app.rerender(
      <App key={++resetKey} sessionId={nextSessionId ?? options.sessionId} />,
    );
  });
}
