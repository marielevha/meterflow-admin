import Calendar from "@/components/calendar/Calendar";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { ADMIN_PERMISSION_GROUPS, requireAdminPermissions } from "@/lib/auth/adminPermissions";
import { getAdminTranslator } from "@/lib/admin-i18n/server";
import { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Next.js Calender | TailAdmin - Next.js Dashboard Template",
  description:
    "This is Next.js Calender page for TailAdmin  Tailwind CSS Admin Dashboard Template",
  // other metadata
};
export default async function page() {
  await requireAdminPermissions("/admin/calendar", ADMIN_PERMISSION_GROUPS.calendarView);
  const { t } = await getAdminTranslator();
  return (
    <div>
      <PageBreadcrumb pageTitle={t("calendarPage.pageTitle")} />
      <Calendar />
    </div>
  );
}
