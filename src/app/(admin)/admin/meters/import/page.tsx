import { Metadata } from "next";
import { redirect } from "next/navigation";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import ImportMetersPanel from "@/components/meters/ImportMetersPanel";
import { getAdminTranslator } from "@/lib/admin-i18n/server";
import { ADMIN_PERMISSION_GROUPS, requireAdminPermissions } from "@/lib/auth/adminPermissions";

export const metadata: Metadata = {
  title: "Import meters",
  description: "Bulk import meters from CSV",
};

export default async function ImportMetersPage() {
  await requireAdminPermissions("/admin/meters/import", ADMIN_PERMISSION_GROUPS.metersImport, {
    requireExplicitPermissions: true,
    redirectOnForbidden: "/admin/meters",
  });
  const { t } = await getAdminTranslator();

  return (
    <div>
      <PageBreadcrumb pageTitle={t("meterImport.pageTitle")} />
      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
          {t("meterImport.heroTitle")}
        </h3>
        <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-gray-400">
          {t("meterImport.heroDescription")}
        </p>
      </div>

      <ImportMetersPanel />
    </div>
  );
}
