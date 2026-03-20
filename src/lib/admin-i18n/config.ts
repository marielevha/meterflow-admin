export const ADMIN_LOCALE_COOKIE = "admin_locale";
export const ADMIN_LOCALES = ["fr", "en", "ln"] as const;
export type AdminLocale = (typeof ADMIN_LOCALES)[number];
export const DEFAULT_ADMIN_LOCALE: AdminLocale = "fr";

export function normalizeAdminLocale(input: string | null | undefined): AdminLocale {
  if (!input) return DEFAULT_ADMIN_LOCALE;
  const normalized = input.toLowerCase();
  if (normalized.startsWith("fr")) return "fr";
  if (normalized.startsWith("en")) return "en";
  if (normalized.startsWith("ln")) return "ln";
  return DEFAULT_ADMIN_LOCALE;
}
