import { Metadata } from "next";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import AppSettingsForm from "@/components/settings/AppSettingsForm";
import { getAdminTranslator } from "@/lib/admin-i18n/server";
import {
  ADMIN_PERMISSION_GROUPS,
  hasAnyPermissionCode,
  requireAdminPermissions,
} from "@/lib/auth/adminPermissions";
import { getCurrentStaffPermissionCodes } from "@/lib/auth/staffServerSession";
import { getAppSettings } from "@/lib/settings/serverSettings";

export const metadata: Metadata = {
  title: "Settings",
  description: "Application settings page",
};

export default async function SettingsPage() {
  const staff = await requireAdminPermissions("/admin/settings", ADMIN_PERMISSION_GROUPS.settingsView);
  const { t } = await getAdminTranslator();
  const permissionCodes = await getCurrentStaffPermissionCodes(staff.id);
  const canManageSettings = hasAnyPermissionCode(permissionCodes, ADMIN_PERMISSION_GROUPS.settingsManage);
  const settings = await getAppSettings();

  return (
    <div>
      <PageBreadcrumb pageTitle={t("nav.settings")} />
      <AppSettingsForm initialSettings={settings} canManage={canManageSettings} />
    </div>
  );
}
