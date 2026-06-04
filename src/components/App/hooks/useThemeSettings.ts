import { useCallback, useState } from 'react';

import { SCREEN, THEME } from '@/constants';
import type { Config, Screen, ThemeId } from '@/types';

interface UseThemeSettingsOptions {
  currentTheme: ThemeId;
  onUpdateConfig: (update: Partial<Config>) => void;
  setScreen: (screen: Screen) => void;
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
    handleThemeClose,
    handleThemePreview,
    handleThemeSave,
    setPreviewThemeId,
  };
}
