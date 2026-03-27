import { Metadata } from "next";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import AppSettingsForm from "@/components/settings/AppSettingsForm";
import { getAdminTranslator } from "@/lib/admin-i18n/server";
import { ADMIN_PERMISSION_GROUPS, requireAdminPermissions } from "@/lib/auth/adminPermissions";
import { getAppSettings } from "@/lib/settings/serverSettings";

export const metadata: Metadata = {
  title: "Settings",
  description: "Application settings page",
};

export default async function SettingsPage() {
  await requireAdminPermissions("/admin/settings", ADMIN_PERMISSION_GROUPS.settingsManage);
  const { t } = await getAdminTranslator();
  const settings = await getAppSettings();

  return (
    <div>
      <PageBreadcrumb pageTitle={t("nav.settings")} />
      <AppSettingsForm initialSettings={settings} />
    </div>
  );
}
