import { render } from 'ink-testing-library';

import { THEME } from '@/constants';
import { ThemeProvider } from '@/contexts';
import type { ThemeDefinition } from '@/types';

interface Options {
  theme?: ThemeDefinition;
}

type RenderWithThemeResult = Omit<ReturnType<typeof render>, 'rerender'> & {
  rerender: (ui: React.ReactElement) => void;
};

/**
 * Test helper that wraps a component with ThemeProvider.
 * Uses default theme if no theme override is provided.
 */
export function renderWithTheme(
  ui: React.ReactElement,
  options: Options = {},
): RenderWithThemeResult {
  const { theme } = options;
  const activeTheme = theme ?? THEME.getTheme();

  const wrap = (element: React.ReactElement) =>
    (
      <ThemeProvider theme={activeTheme}>{element}</ThemeProvider>
    ) as React.ReactElement;

  const result = render(wrap(ui));

  return {
    ...result,
    rerender: (newUi: React.ReactElement) => {
      result.rerender(wrap(newUi));
    },
  };
}
