import AsyncStorage from '@react-native-async-storage/async-storage';

export type StoredThemePreference = 'system' | 'light' | 'dark';
export type StoredLanguagePreference = 'fr' | 'en' | 'ln';

export type StoredAppPreferences = {
  themePreference: StoredThemePreference;
  language: StoredLanguagePreference;
  keepSession: boolean;
  showCameraHelp: boolean;
};

const APP_PREFERENCES_KEY = 'meterflow.app.preferences';

const DEFAULT_APP_PREFERENCES: StoredAppPreferences = {
  themePreference: 'system',
  language: 'fr',
  keepSession: true,
  showCameraHelp: true,
};

let memoryPreferences: StoredAppPreferences = { ...DEFAULT_APP_PREFERENCES };

export function getStoredAppPreferencesSnapshot() {
  return memoryPreferences;
}

function normalizePreferences(value: unknown): StoredAppPreferences {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...DEFAULT_APP_PREFERENCES };
  }

  const candidate = value as Record<string, unknown>;

  return {
    themePreference:
      candidate.themePreference === 'light' ||
      candidate.themePreference === 'dark' ||
      candidate.themePreference === 'system'
        ? candidate.themePreference
        : DEFAULT_APP_PREFERENCES.themePreference,
    language:
      candidate.language === 'en' || candidate.language === 'fr' || candidate.language === 'ln'
        ? candidate.language
        : DEFAULT_APP_PREFERENCES.language,
    keepSession:
      typeof candidate.keepSession === 'boolean'
        ? candidate.keepSession
        : DEFAULT_APP_PREFERENCES.keepSession,
    showCameraHelp:
      typeof candidate.showCameraHelp === 'boolean'
        ? candidate.showCameraHelp
        : DEFAULT_APP_PREFERENCES.showCameraHelp,
  };
}

export async function readStoredAppPreferences() {
  try {
    const raw = await AsyncStorage.getItem(APP_PREFERENCES_KEY);
    if (!raw) {
      memoryPreferences = { ...DEFAULT_APP_PREFERENCES };
      return memoryPreferences;
    }

    memoryPreferences = normalizePreferences(JSON.parse(raw));
    return memoryPreferences;
  } catch {
    return memoryPreferences;
  }
}

export async function writeStoredAppPreferences(preferences: StoredAppPreferences) {
  memoryPreferences = preferences;

  try {
    await AsyncStorage.setItem(APP_PREFERENCES_KEY, JSON.stringify(preferences));
  } catch {
    // Fallback to memory.
  }
}

export async function updateStoredAppPreferences(patch: Partial<StoredAppPreferences>) {
  const current = await readStoredAppPreferences();
  const next = { ...current, ...patch };
  await writeStoredAppPreferences(next);
  return next;
}
