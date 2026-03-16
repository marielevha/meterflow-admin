import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { DarkTheme, DefaultTheme, type Theme } from '@react-navigation/native';
import { useColorScheme as useDeviceColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';
import {
  readStoredAppPreferences,
  updateStoredAppPreferences,
  type StoredThemePreference,
} from '@/lib/storage/app-preferences';

export type ThemePreference = StoredThemePreference;
export type ResolvedTheme = 'light' | 'dark';

type AppThemeContextValue = {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (value: ThemePreference) => void;
  navigationTheme: Theme;
};

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

function buildNavigationTheme(resolvedTheme: ResolvedTheme): Theme {
  const palette = Colors[resolvedTheme];
  const base = resolvedTheme === 'dark' ? DarkTheme : DefaultTheme;

  return {
    ...base,
    colors: {
      ...base.colors,
      primary: palette.tint,
      background: palette.background,
      card: palette.surface,
      text: palette.text,
      border: palette.border,
      notification: palette.accent,
    },
  };
}

export function AppThemeProvider({ children }: PropsWithChildren) {
  const deviceTheme = useDeviceColorScheme();
  const [preference, setPreference] = useState<ThemePreference>('system');

  useEffect(() => {
    let active = true;

    void readStoredAppPreferences().then((preferences) => {
      if (active) {
        setPreference(preferences.themePreference);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const resolvedTheme: ResolvedTheme =
    preference === 'system' ? (deviceTheme === 'dark' ? 'dark' : 'light') : preference;

  const updatePreference = useCallback((value: ThemePreference) => {
    setPreference(value);
    void updateStoredAppPreferences({ themePreference: value });
  }, []);

  const value = useMemo<AppThemeContextValue>(
    () => ({
      preference,
      resolvedTheme,
      setPreference: updatePreference,
      navigationTheme: buildNavigationTheme(resolvedTheme),
    }),
    [preference, resolvedTheme, updatePreference]
  );

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}

export function useAppTheme() {
  const context = useContext(AppThemeContext);

  if (!context) {
    throw new Error('useAppTheme must be used within AppThemeProvider');
  }

  return context;
}
