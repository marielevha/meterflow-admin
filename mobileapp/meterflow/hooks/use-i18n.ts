import { useCallback } from 'react';

import { appTranslations, DEFAULT_LANGUAGE, type AppLanguage } from '@/lib/i18n/translations';
import { useMobilePreferences } from '@/providers/mobile-preferences-provider';

type TranslationParams = Record<string, string | number | boolean>;

function interpolate(template: string, params?: TranslationParams) {
  if (!params) {
    return template;
  }

  return Object.entries(params).reduce((result, [key, value]) => {
    return result.replaceAll(`{${key}}`, String(value));
  }, template);
}

function localeForLanguage(language: AppLanguage) {
  if (language === 'en') return 'en-US';
  if (language === 'ln') return 'ln-CG';
  return 'fr-FR';
}

export function useI18n() {
  const { preferences } = useMobilePreferences();
  const language = preferences.language ?? DEFAULT_LANGUAGE;

  const t = useCallback(
    (key: string, params?: TranslationParams) => {
      const template =
        appTranslations[language][key] ??
        appTranslations[DEFAULT_LANGUAGE][key] ??
        key;

      return interpolate(template, params);
    },
    [language]
  );

  return {
    language,
    locale: localeForLanguage(language),
    t,
  };
}
