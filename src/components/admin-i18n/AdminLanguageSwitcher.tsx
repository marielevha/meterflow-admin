"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminI18n } from "@/hooks/use-admin-i18n";

export default function AdminLanguageSwitcher() {
  const router = useRouter();
  const { locale, t } = useAdminI18n();
  const [isSaving, setIsSaving] = useState(false);

  async function handleChange(nextLocale: string) {
    if (nextLocale === locale || isSaving) return;
    setIsSaving(true);
    try {
      await fetch("/api/v1/admin/preferences/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: nextLocale }),
      });
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <label className="flex items-center text-sm text-gray-600 dark:text-gray-300">
      <select
        value={locale}
        onChange={(event) => void handleChange(event.target.value)}
        aria-label={t("layout.languageSwitchLabel")}
        className="h-10 rounded-full border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-hidden transition hover:bg-gray-50 focus:border-brand-300 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
      >
        <option value="fr">{t("common.french")}</option>
        <option value="en">{t("common.english")}</option>
        <option value="ln">{t("common.lingala")}</option>
      </select>
    </label>
  );
}
