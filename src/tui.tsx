import { render } from 'ink';

import { App } from './components';
import { screen } from './utils';

export function renderApp(): void {
  let resetKey = 0;

  const app = render(<App key={resetKey} />, {
    exitOnCtrlC: false,
    maxFps: 60,
  });

  screen.setClearHandler(() => {
    screen.reset();
    app.rerender(<App key={++resetKey} />);
  });
}
