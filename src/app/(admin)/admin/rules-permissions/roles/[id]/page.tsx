import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Badge from "@/components/ui/badge/Badge";
import { translateUserRole } from "@/lib/admin-i18n/labels";
import { getAdminTranslator } from "@/lib/admin-i18n/server";
import { ADMIN_PERMISSION_GROUPS, requireAdminPermissions } from "@/lib/auth/adminPermissions";
import { prisma } from "@/lib/prisma";
import { updateRolePermissionsAction } from "./actions";

export const metadata: Metadata = {
  title: "Role Permissions",
  description: "Manage permissions assigned to a role",
};

function roleBadge(code: string) {
  if (code === "ADMIN") return "error" as const;
  if (code === "SUPERVISOR") return "warning" as const;
  if (code === "AGENT") return "info" as const;
  return "success" as const;
}

function messageFromError(errorCode: string, t: (key: string) => string) {
  if (errorCode === "role_not_found") return t("rbac.errorRoleNotFound");
  if (errorCode === "invalid_permission_ids") return t("rbac.errorInvalidPermissionIds");
  return "";
}

export default async function RolePermissionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPermissions("/admin/rules-permissions", ADMIN_PERMISSION_GROUPS.rbacManage);
  const { t } = await getAdminTranslator();
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const errorCode = Array.isArray(resolvedSearchParams.error)
    ? resolvedSearchParams.error[0]
    : resolvedSearchParams.error || "";
  const updated = firstValue(resolvedSearchParams.updated) === "1";

  const role = await prisma.role.findFirst({
    where: { id, deletedAt: null },
    include: {
      permissions: {
        where: { deletedAt: null },
        select: { permissionId: true },
      },
      userAssignments: {
        where: { deletedAt: null },
        select: { id: true },
      },
    },
  });

  if (!role) {
    notFound();
  }

  const allPermissions = await prisma.permission.findMany({
    where: { deletedAt: null },
    orderBy: [{ resource: "asc" }, { action: "asc" }, { code: "asc" }],
  });

  const selectedIds = new Set(role.permissions.map((item) => item.permissionId));
  const grouped = allPermissions.reduce<Record<string, typeof allPermissions>>((acc, permission) => {
    acc[permission.resource] = acc[permission.resource] || [];
    acc[permission.resource].push(permission);
    return acc;
  }, {});

  const submit = updateRolePermissionsAction.bind(null, role.id);
  const errorMessage = messageFromError(errorCode, t);

  return (
    <div>
      <PageBreadcrumb pageTitle={t("rbac.rolePermissionsPageTitle")} />

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t("users.roleLabel")}</p>
          <div className="mt-2">
            <Badge size="sm" color={roleBadge(role.code)}>
              {translateUserRole(role.code, t)}
            </Badge>
          </div>
          <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">{role.name}</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{role.code}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t("rbac.assignedPermissions")}</p>
          <h3 className="mt-2 text-2xl font-semibold text-gray-800 dark:text-white/90">{selectedIds.size}</h3>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t("rbac.usersWithRole")}</p>
          <h3 className="mt-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
            {role.userAssignments.length}
          </h3>
        </div>
      </div>

      <form action={submit} className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        {updated ? (
          <div className="mb-4 rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-300">
            {t("rbac.permissionsUpdated")}
          </div>
        ) : null}
        {errorMessage ? (
          <div className="mb-4 rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300">
            {errorMessage}
          </div>
        ) : null}

        <div className="space-y-6">
          {Object.entries(grouped).map(([resource, permissions]) => (
            <section key={resource} className="rounded-xl border border-gray-100 p-4 dark:border-gray-800">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                {resource}
              </h3>
              <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                {permissions.map((permission) => (
                  <label
                    key={permission.id}
                    className="flex items-start gap-3 rounded-lg border border-gray-200 p-3 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-white/[0.03]"
                  >
                    <input
                      type="checkbox"
                      name="permissionIds"
                      value={permission.id}
                      defaultChecked={selectedIds.has(permission.id)}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500/30 dark:border-gray-700"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-white/90">{permission.code}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {permission.name} ({permission.action})
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <Link
            href="/admin/rules-permissions"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]"
          >
            {t("common.back")}
          </Link>
          <button
            type="submit"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600"
          >
            {t("rbac.savePermissions")}
          </button>
        </div>
      </form>
    </div>
  );
}

function firstValue(input: string | string[] | undefined): string {
  if (Array.isArray(input)) return input[0] ?? "";
  return input ?? "";
}
