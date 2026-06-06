import { Text } from 'ink';
import { render } from 'ink-testing-library';
import { Component } from 'react';

import { THEME } from '@/constants';
import { renderWithTheme } from '@/utils/testing';

import { ThemeProvider, useOptionalTheme, useTheme } from './ThemeContext';

function TestUseTheme() {
  const theme = useTheme();
  return <Text>{theme.codeTheme}</Text>;
}

function TestUseOptionalTheme() {
  const theme = useOptionalTheme();
  return <Text>{theme?.codeTheme ?? 'null'}</Text>;
}

class TestErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return <Text>{this.state.error?.message}</Text>;
    }
    return this.props.children;
  }
}

describe('useTheme', () => {
  it('returns theme when used within ThemeProvider', () => {
    const theme = THEME.getTheme();
    const { lastFrame } = renderWithTheme(
      <ThemeProvider theme={theme}>
        <TestUseTheme />
      </ThemeProvider>,
    );

    expect(lastFrame()).toContain(theme.codeTheme);
  });

  it('throws error when used outside ThemeProvider', () => {
    const { lastFrame } = render(
      <TestErrorBoundary>
        <TestUseTheme />
      </TestErrorBoundary>,
    );

    expect(lastFrame()).toContain(
      'useTheme must be used within a ThemeProvider',
    );
  });
});

describe('useOptionalTheme', () => {
  it('returns theme when used within ThemeProvider', () => {
    const theme = THEME.getTheme();
    const { lastFrame } = renderWithTheme(
      <ThemeProvider theme={theme}>
        <TestUseOptionalTheme />
      </ThemeProvider>,
    );

    expect(lastFrame()).toContain(theme.codeTheme);
  });

  it('returns null when used outside ThemeProvider', () => {
    const { lastFrame } = render(<TestUseOptionalTheme />);

    expect(lastFrame()).toContain('null');
  });
});
