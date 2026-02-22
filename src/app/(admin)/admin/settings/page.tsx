import { Metadata } from "next";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import AppSettingsForm from "@/components/settings/AppSettingsForm";
import { getAppSettings } from "@/lib/settings/serverSettings";

export const metadata: Metadata = {
  title: "Settings | MeterFlow Dashboard",
  description: "Application settings page",
};

export default async function SettingsPage() {
  const settings = await getAppSettings();

  return (
    <div>
      <PageBreadcrumb pageTitle="Settings" />
      <AppSettingsForm initialSettings={settings} />
    </div>
  );
}
