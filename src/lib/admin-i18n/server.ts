import { cookies } from "next/headers";
import {
  ADMIN_LOCALE_COOKIE,
  DEFAULT_ADMIN_LOCALE,
  type AdminLocale,
  normalizeAdminLocale,
} from "@/lib/admin-i18n/config";
import { adminMessages } from "@/lib/admin-i18n/messages";
import { translateAdminMessage } from "@/lib/admin-i18n/shared";
import { getAppSettings } from "@/lib/settings/serverSettings";

export async function getAdminLocale(): Promise<AdminLocale> {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(ADMIN_LOCALE_COOKIE)?.value;
  if (cookieValue) return normalizeAdminLocale(cookieValue);

  try {
    const settings = await getAppSettings();
    return normalizeAdminLocale(settings.locale);
  } catch {
    return DEFAULT_ADMIN_LOCALE;
  }
}

export async function getAdminMessages() {
  const locale = await getAdminLocale();
  return adminMessages[locale];
}

export async function getAdminTranslator() {
  const locale = await getAdminLocale();
  const messages = adminMessages[locale];

  return {
    locale,
    messages,
    t: (key: string, values?: Record<string, string | number>) =>
      translateAdminMessage(messages, key, values),
  };
}
