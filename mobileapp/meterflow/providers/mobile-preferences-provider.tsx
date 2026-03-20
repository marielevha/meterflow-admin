import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import { syncStoredMobileSession } from '@/lib/auth/mobile-session-store';
import {
  readStoredAppPreferences,
  updateStoredAppPreferences,
  type StoredAppPreferences,
} from '@/lib/storage/app-preferences';

type MobilePreferencesContextValue = {
  preferences: StoredAppPreferences;
  isReady: boolean;
  updatePreferences: (patch: Partial<StoredAppPreferences>) => Promise<void>;
};

const DEFAULT_PREFERENCES: StoredAppPreferences = {
  themePreference: 'system',
  language: 'fr',
  keepSession: true,
  showCameraHelp: true,
};

const MobilePreferencesContext = createContext<MobilePreferencesContextValue | null>(null);

export function MobilePreferencesProvider({ children }: PropsWithChildren) {
  const [preferences, setPreferences] = useState<StoredAppPreferences>(DEFAULT_PREFERENCES);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let active = true;

    void readStoredAppPreferences()
      .then((value) => {
        if (active) {
          setPreferences(value);
        }
      })
      .finally(() => {
        if (active) {
          setIsReady(true);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  async function updatePreferences(patch: Partial<StoredAppPreferences>) {
    const next = await updateStoredAppPreferences(patch);
    setPreferences(next);

    if (patch.keepSession !== undefined) {
      await syncStoredMobileSession();
    }
  }

  const value = useMemo<MobilePreferencesContextValue>(
    () => ({
      preferences,
      isReady,
      updatePreferences,
    }),
    [isReady, preferences]
  );

  return <MobilePreferencesContext.Provider value={value}>{children}</MobilePreferencesContext.Provider>;
}

export function useMobilePreferences() {
  const context = useContext(MobilePreferencesContext);

  if (!context) {
    throw new Error('useMobilePreferences must be used within MobilePreferencesProvider');
  }

  return context;
}
