import { ROLE, THEME } from '@/constants';

import { getMessageColor } from './styles';

describe('styles', () => {
  describe('getMessageColor', () => {
    const theme = THEME.getTheme();

    it('returns undefined for user and assistant roles', () => {
      expect(getMessageColor(ROLE.USER, theme)).toBeUndefined();
      expect(getMessageColor(ROLE.ASSISTANT, theme)).toBeUndefined();
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
