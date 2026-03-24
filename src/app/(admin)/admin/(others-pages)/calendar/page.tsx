import Calendar from "@/components/calendar/Calendar";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
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
  const { t } = await getAdminTranslator();
  return (
    <div>
      <PageBreadcrumb pageTitle={t("calendarPage.pageTitle")} />
      <Calendar />
    </div>
  );
}
