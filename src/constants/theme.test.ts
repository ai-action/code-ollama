import { DEFAULT_THEME_ID, getTheme, LIST } from './theme';

describe('getTheme', () => {
  it('returns the default theme when called with no argument', () => {
    const theme = getTheme();
    expect(theme.id).toBe(DEFAULT_THEME_ID);
  });

  it('returns the matching theme for a known id', () => {
    const theme = getTheme('nord');
    expect(theme.id).toBe('nord');
  });

  it('falls back to LIST[0] for an unrecognized id', () => {
    const theme = getTheme('unknown-theme' as never);
    expect(theme).toBe(LIST[0]);
  });
});
