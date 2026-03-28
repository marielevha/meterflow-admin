import React from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import AdminI18nProvider from "@/components/admin-i18n/AdminI18nProvider";
import AdminShell from "@/layout/AdminShell";
import { getAdminLocale, getAdminMessages } from "@/lib/admin-i18n/server";
import {
  getCurrentStaffFromServerComponent,
  getCurrentStaffPermissionCodes,
} from "@/lib/auth/staffServerSession";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const staff = await getCurrentStaffFromServerComponent();
  if (!staff) {
    const requestHeaders = await headers();
    const currentPath = requestHeaders.get("x-current-path") || "/admin/overview";
    redirect(`/signin?next=${encodeURIComponent(currentPath)}`);
  }

  const permissionCodes = await getCurrentStaffPermissionCodes(staff.id);
  const locale = await getAdminLocale();
  const messages = await getAdminMessages();

  return (
    <AdminI18nProvider locale={locale} messages={messages}>
      <AdminShell permissionCodes={permissionCodes}>{children}</AdminShell>
    </AdminI18nProvider>
  );
}
