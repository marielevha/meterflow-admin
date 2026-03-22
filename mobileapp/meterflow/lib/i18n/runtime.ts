import { appTranslations, DEFAULT_LANGUAGE, type AppLanguage } from '@/lib/i18n/translations';
import { getStoredAppPreferencesSnapshot } from '@/lib/storage/app-preferences';

export type TranslationParams = Record<string, string | number | boolean>;

export function interpolate(template: string, params?: TranslationParams) {
  if (!params) {
    return template;
  }

  return Object.entries(params).reduce((result, [key, value]) => {
    return result.replaceAll(`{${key}}`, String(value));
  }, template);
}

export function localeForLanguage(language: AppLanguage) {
  if (language === 'en') return 'en-US';
  if (language === 'ln') return 'ln-CG';
  return 'fr-FR';
}

export function translateApp(key: string, params?: TranslationParams, language?: AppLanguage) {
  const resolvedLanguage = language ?? DEFAULT_LANGUAGE;
  const template =
    appTranslations[resolvedLanguage][key] ??
    appTranslations[DEFAULT_LANGUAGE][key] ??
    key;

  return interpolate(template, params);
}

export function translateCurrentApp(key: string, params?: TranslationParams) {
  return translateApp(key, params, getStoredAppPreferencesSnapshot().language);
}
