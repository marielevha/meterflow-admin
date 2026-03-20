"use client";

import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import type { AdminLocale } from "@/lib/admin-i18n/config";
import type { AdminMessages } from "@/lib/admin-i18n/messages";
import { translateAdminMessage } from "@/lib/admin-i18n/shared";

type AdminI18nContextValue = {
  locale: AdminLocale;
  messages: AdminMessages;
  t: (key: string, values?: Record<string, string | number>) => string;
};

const AdminI18nContext = createContext<AdminI18nContextValue | null>(null);

export default function AdminI18nProvider({
  locale,
  messages,
  children,
}: {
  locale: AdminLocale;
  messages: AdminMessages;
  children: ReactNode;
}) {
  const value = useMemo<AdminI18nContextValue>(
    () => ({
      locale,
      messages,
      t: (key, values) => translateAdminMessage(messages, key, values),
    }),
    [locale, messages]
  );

  return <AdminI18nContext.Provider value={value}>{children}</AdminI18nContext.Provider>;
}

export function useAdminI18nContext() {
  const context = useContext(AdminI18nContext);
  if (!context) {
    throw new Error("useAdminI18nContext must be used within AdminI18nProvider");
  }
  return context;
}
