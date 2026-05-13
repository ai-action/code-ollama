import { render } from 'ink';

import { App } from './components';
import { screen } from './utils';

export function renderApp(sessionId?: string): void {
  let resetKey = 0;

  const app = render(<App key={resetKey} sessionId={sessionId} />, {
    exitOnCtrlC: false,
    maxFps: 60,
  });

  screen.setClearHandler((nextSessionId) => {
    screen.reset();
    app.rerender(
      <App key={++resetKey} sessionId={nextSessionId ?? sessionId} />,
    );
  });
}
