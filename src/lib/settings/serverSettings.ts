import { prisma } from "@/lib/prisma";
import {
  APP_SETTINGS_DB_KEY,
  DEFAULT_APP_SETTINGS,
  mergeAppSettings,
  normalizeAppSettings,
  type AppSettings,
} from "@/lib/settings/appSettings";

export async function getAppSettings(): Promise<AppSettings> {
  try {
    const row = await prisma.appSetting.findFirst({
      where: { key: APP_SETTINGS_DB_KEY, deletedAt: null },
      select: { value: true },
    });

    if (!row) return { ...DEFAULT_APP_SETTINGS };
    return normalizeAppSettings(row.value);
  } catch {
    // During image builds or temporary database outages, fall back to defaults
    // so static rendering does not hard-fail on app settings reads.
    return { ...DEFAULT_APP_SETTINGS };
  }
}

export async function saveAppSettings(patch: unknown): Promise<AppSettings> {
  const current = await getAppSettings();
  const next = mergeAppSettings(current, patch);

  await prisma.appSetting.upsert({
    where: { key: APP_SETTINGS_DB_KEY },
    create: { key: APP_SETTINGS_DB_KEY, value: next },
    update: { value: next, deletedAt: null },
  });

  return next;
}
