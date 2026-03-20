"use client";

import { useAdminI18nContext } from "@/components/admin-i18n/AdminI18nProvider";

export function useAdminI18n() {
  return useAdminI18nContext();
}
