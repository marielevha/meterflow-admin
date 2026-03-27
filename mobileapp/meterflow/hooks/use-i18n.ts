import { useCallback } from 'react';

import { DEFAULT_LANGUAGE } from '@/lib/i18n/translations';
import { localeForLanguage, translateApp, type TranslationParams } from '@/lib/i18n/runtime';
import { useMobilePreferences } from '@/providers/mobile-preferences-provider';

export function useI18n() {
  const { preferences } = useMobilePreferences();
  const language = preferences.language ?? DEFAULT_LANGUAGE;

  const t = useCallback(
    (key: string, params?: TranslationParams) => translateApp(key, params, language),
    [language]
  );

  return {
    language,
    locale: localeForLanguage(language),
    t,
  };
}
