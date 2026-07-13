import { ROLE, THEME } from '@/constants';

import { getMessageColor } from './styles';

describe('styles', () => {
  describe('getMessageColor', () => {
    const theme = THEME.getTheme();

    it('returns undefined for user and regular assistant messages', () => {
      expect(getMessageColor(ROLE.USER, theme)).toBeUndefined();
      expect(getMessageColor(ROLE.ASSISTANT, theme)).toBeUndefined();
    });

    it('returns the error color for assistant error messages', () => {
      expect(
        getMessageColor(ROLE.ASSISTANT, theme, 'Error: fetch failed'),
      ).toBe(theme.colors.error);
    });

    it('returns messageSystem color for system role', () => {
      expect(getMessageColor(ROLE.SYSTEM, theme)).toBe(
        theme.colors.messageSystem,
      );
    });

    it('returns undefined for unknown role', () => {
      expect(getMessageColor('unknown', theme)).toBeUndefined();
    });
  });
});
