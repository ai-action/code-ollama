import { useCallback, useState } from 'react';

import { THEME } from '@/constants';
import type { Config, ThemeId } from '@/types';

import { SCREEN } from '../constants';

interface UseThemeSettingsOptions {
  currentTheme: ThemeId;
  onUpdateConfig: (update: Partial<Config>) => void;
  setScreen: (screen: SCREEN) => void;
}

export function useThemeSettings({
  currentTheme,
  onUpdateConfig,
  setScreen,
}: UseThemeSettingsOptions) {
  const [previewThemeId, setPreviewThemeId] = useState<ThemeId | null>(null);

  const activeThemeId = previewThemeId ?? currentTheme;
  const activeTheme = THEME.getTheme(activeThemeId);

  const handleThemePreview = useCallback((themeId: ThemeId) => {
    setPreviewThemeId(themeId);
  }, []);

  const handleThemeClose = useCallback(() => {
    setPreviewThemeId(null);
    setScreen(SCREEN.CHAT);
  }, [setScreen]);

  const handleThemeSave = useCallback(
    (themeId: ThemeId) => {
      setPreviewThemeId(null);
      onUpdateConfig({ theme: themeId });
    },
    [onUpdateConfig],
  );

  return {
    activeTheme,
    activeThemeId,
    handleThemeClose,
    handleThemePreview,
    handleThemeSave,
    previewThemeId,
    setPreviewThemeId,
  };
}
