import { render } from 'ink';

import { App } from './components';
import { screen } from './utils';

export function renderApp(): void {
  const tree = <App />;
  const app = render(tree, {
    exitOnCtrlC: false,
    maxFps: 60,
  });

  screen.setClearHandler(() => {
    app.clear();
    app.rerender(tree);
  });
}
