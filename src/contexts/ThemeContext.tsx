import { createContext, useContext } from 'react';

import type { ThemeDefinition } from '@/types';

const ThemeContext = createContext<ThemeDefinition | null>(null);

interface ThemeProviderProps {
  theme: ThemeDefinition;
  children: React.ReactNode;
}

export function ThemeProvider({ theme, children }: ThemeProviderProps) {
  return (
    <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
  );
}

/**
 * Hook to access the current theme from context.
 * Throws if used outside a ThemeProvider.
 */
export function useTheme(): ThemeDefinition {
  const context = useContext(ThemeContext);
  if (context === null) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

/**
 * Hook to optionally access the current theme from context.
 * Returns null if used outside a ThemeProvider (does NOT throw).
 * Useful for components that accept a theme prop as override.
 */
export function useOptionalTheme(): ThemeDefinition | null {
  return useContext(ThemeContext);
}
