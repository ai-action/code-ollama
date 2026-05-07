import { render } from 'ink';

import { App } from './components';
import { screen } from './utils';

export function renderApp(): void {
  const app = render(<App />);
  screen.setClearHandler(() => {
    app.clear();
  });
}
