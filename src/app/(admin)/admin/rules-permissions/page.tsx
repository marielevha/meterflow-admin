import { Metadata } from "next";
import Link from "next/link";
import { Prisma } from "@prisma/client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import ComponentCard from "@/components/common/ComponentCard";
import Badge from "@/components/ui/badge/Badge";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import RolesFilters from "@/components/rbac/RolesFilters";
import PermissionsFilters from "@/components/rbac/PermissionsFilters";
import { getAdminTranslator } from "@/lib/admin-i18n/server";
import { translateUserRole } from "@/lib/admin-i18n/labels";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Rules & Permissions",
  description: "RBAC management overview for roles and permissions",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const ROLE_PAGE_SIZE_OPTIONS = [5, 10, 20];
const PERM_PAGE_SIZE_OPTIONS = [10, 20, 50];

function firstValue(input: string | string[] | undefined): string {
  if (Array.isArray(input)) return input[0] ?? "";
  return input ?? "";
}

function badgeForRoleCode(code: string) {
  if (code === "ADMIN") return "error" as const;
  if (code === "SUPERVISOR") return "warning" as const;
  if (code === "AGENT") return "info" as const;
  return "success" as const;
}

export default async function RulesPermissionsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { t } = await getAdminTranslator();
  const resolvedSearchParams = await searchParams;

  const rolesQ = firstValue(resolvedSearchParams.rolesQ).trim();
  const rawRolesPageSize = Number(firstValue(resolvedSearchParams.rolesPageSize) || "5");
  const rolesPageSize = ROLE_PAGE_SIZE_OPTIONS.includes(rawRolesPageSize) ? rawRolesPageSize : 5;
  const requestedRolesPage = Math.max(1, Number(firstValue(resolvedSearchParams.rolesPage) || "1"));

  const permQ = firstValue(resolvedSearchParams.permQ).trim();
  const permRole = firstValue(resolvedSearchParams.permRole).trim();
  const permResource = firstValue(resolvedSearchParams.permResource).trim();
  const rawPermPageSize = Number(firstValue(resolvedSearchParams.permPageSize) || "10");
  const permPageSize = PERM_PAGE_SIZE_OPTIONS.includes(rawPermPageSize) ? rawPermPageSize : 10;
  const requestedPermPage = Math.max(1, Number(firstValue(resolvedSearchParams.permPage) || "1"));

  const roleWhere: Prisma.RoleWhereInput = {
    deletedAt: null,
    ...(rolesQ
      ? {
          OR: [
            { code: { contains: rolesQ, mode: "insensitive" } },
            { name: { contains: rolesQ, mode: "insensitive" } },
            { description: { contains: rolesQ, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const permissionWhere: Prisma.PermissionWhereInput = {
    deletedAt: null,
    ...(permResource ? { resource: { equals: permResource, mode: "insensitive" } } : {}),
    ...(permQ
      ? {
          OR: [
            { code: { contains: permQ, mode: "insensitive" } },
            { name: { contains: permQ, mode: "insensitive" } },
            { resource: { contains: permQ, mode: "insensitive" } },
            { action: { contains: permQ, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(permRole
      ? {
          rolePermissions: {
            some: {
              deletedAt: null,
              role: {
                deletedAt: null,
                code: permRole,
              },
            },
          },
        }
      : {}),
  };

  const [
    rolesFilteredCount,
    permissionsFilteredCount,
    allRolesCount,
    allPermissionsCount,
    allMappingsCount,
    allAssignmentsCount,
  ] = await prisma.$transaction([
    prisma.role.count({ where: roleWhere }),
    prisma.permission.count({ where: permissionWhere }),
    prisma.role.count({ where: { deletedAt: null } }),
    prisma.permission.count({ where: { deletedAt: null } }),
    prisma.rolePermission.count({ where: { deletedAt: null } }),
    prisma.userRoleAssignment.count({ where: { deletedAt: null } }),
  ]);

  const rolesTotalPages = Math.max(1, Math.ceil(rolesFilteredCount / rolesPageSize));
  const rolesPage = Math.min(requestedRolesPage, rolesTotalPages);
  const roles = await prisma.role.findMany({
    where: roleWhere,
    orderBy: { code: "asc" },
    skip: Math.max(0, (rolesPage - 1) * rolesPageSize),
    take: rolesPageSize,
    include: {
      permissions: {
        where: { deletedAt: null },
        include: { permission: true },
      },
      userAssignments: {
        where: { deletedAt: null },
        select: { id: true },
      },
    },
  });

  const permissionsTotalPages = Math.max(1, Math.ceil(permissionsFilteredCount / permPageSize));
  const permPage = Math.min(requestedPermPage, permissionsTotalPages);
  const permissions = await prisma.permission.findMany({
    where: permissionWhere,
    orderBy: [{ resource: "asc" }, { action: "asc" }, { code: "asc" }],
    skip: Math.max(0, (permPage - 1) * permPageSize),
    take: permPageSize,
    include: {
      rolePermissions: {
        where: {
          deletedAt: null,
          role: {
            deletedAt: null,
            ...(permRole ? { code: permRole } : {}),
          },
        },
        include: { role: true },
      },
    },
  });

  const [allRoleCodesRaw, resourceValuesRaw] = await Promise.all([
    prisma.role.findMany({
      where: { deletedAt: null },
      select: { code: true },
      orderBy: { code: "asc" },
    }),
    prisma.permission.findMany({ where: { deletedAt: null }, select: { resource: true } }),
  ]);

  const allRoleCodes = allRoleCodesRaw.map((role) => role.code);
  const resourceOptions = Array.from(new Set(resourceValuesRaw.map((item) => item.resource))).sort((a, b) =>
    a.localeCompare(b)
  );

  const buildRolesHref = (overrides: {
    rolesPage?: number;
  }) => {
    const params = new URLSearchParams();

    if (rolesQ) params.set("rolesQ", rolesQ);
    params.set("rolesPageSize", String(rolesPageSize));
    if ((overrides.rolesPage ?? rolesPage) > 1) params.set("rolesPage", String(overrides.rolesPage ?? rolesPage));

    if (permQ) params.set("permQ", permQ);
    if (permRole) params.set("permRole", permRole);
    if (permResource) params.set("permResource", permResource);
    params.set("permPageSize", String(permPageSize));
    if (permPage > 1) params.set("permPage", String(permPage));

    const query = params.toString();
    return query ? `/admin/rules-permissions?${query}` : "/admin/rules-permissions";
  };

  const buildPermissionsHref = (overrides: {
    permPage?: number;
  }) => {
    const params = new URLSearchParams();

    if (rolesQ) params.set("rolesQ", rolesQ);
    params.set("rolesPageSize", String(rolesPageSize));
    if (rolesPage > 1) params.set("rolesPage", String(rolesPage));

    if (permQ) params.set("permQ", permQ);
    if (permRole) params.set("permRole", permRole);
    if (permResource) params.set("permResource", permResource);
    params.set("permPageSize", String(permPageSize));
    if ((overrides.permPage ?? permPage) > 1) params.set("permPage", String(overrides.permPage ?? permPage));

    const query = params.toString();
    return query ? `/admin/rules-permissions?${query}` : "/admin/rules-permissions";
  };

  const visibleRolesPages = (() => {
    const start = Math.max(1, rolesPage - 2);
    const end = Math.min(rolesTotalPages, start + 4);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  })();

  const visiblePermPages = (() => {
    const start = Math.max(1, permPage - 2);
    const end = Math.min(permissionsTotalPages, start + 4);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  })();

  return (
    <div>
      <PageBreadcrumb pageTitle={t("rbac.pageTitle")} />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title={t("rbac.rolesCount")} value={allRolesCount} />
        <StatCard title={t("rbac.permissionsCount")} value={allPermissionsCount} />
        <StatCard title={t("rbac.rolePermissionLinks")} value={allMappingsCount} />
        <StatCard title={t("rbac.userRoleAssignments")} value={allAssignmentsCount} />
      </div>

      <div className="grid grid-cols-1 gap-6 2xl:grid-cols-5">
        <ComponentCard
          title={t("rbac.rolesTitle")}
          desc={t("rbac.rolesDesc")}
          className="2xl:col-span-2"
        >
          <RolesFilters
            initialRolesQ={rolesQ}
            initialRolesPageSize={rolesPageSize}
            permQ={permQ}
            permRole={permRole}
            permResource={permResource}
            permPageSize={permPageSize}
            permPage={permPage}
            pageSizeOptions={ROLE_PAGE_SIZE_OPTIONS}
          />

          <div className="max-w-full overflow-x-auto">
            <div className="min-w-[650px] overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
              <Table>
                <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                  <TableRow>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                      {t("rbac.roleColumn")}
                    </TableCell>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                      {t("rbac.nameColumn")}
                    </TableCell>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                      {t("rbac.usersColumn")}
                    </TableCell>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                      {t("rbac.permissionsColumn")}
                    </TableCell>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                      {t("common.actions")}
                    </TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                  {roles.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                        {t("rbac.noRolesFound")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    roles.map((role) => (
                      <TableRow key={role.id}>
                        <TableCell className="px-4 py-3 text-start">
                          <Badge size="sm" color={badgeForRoleCode(role.code)}>
                            {translateUserRole(role.code, t)}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-start text-sm text-gray-700 dark:text-gray-300">
                          {role.name}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-start text-sm text-gray-700 dark:text-gray-300">
                          {role.userAssignments.length}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-start text-sm text-gray-700 dark:text-gray-300">
                          {role.permissions.filter((item) => item.permission?.deletedAt === null).length}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-start">
                          <Link
                            href={`/admin/rules-permissions/roles/${role.id}`}
                            className="inline-flex h-8 items-center rounded-md border border-gray-300 px-3 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]"
                          >
                            {t("common.manage")}
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t("rbac.showingRolesSummary", {
                start: roles.length === 0 ? 0 : (rolesPage - 1) * rolesPageSize + 1,
                end: Math.min((rolesPage - 1) * rolesPageSize + roles.length, rolesFilteredCount),
                total: rolesFilteredCount,
              })}
            </p>
            <div className="flex items-center gap-2">
              <Link
                href={buildRolesHref({ rolesPage: Math.max(1, rolesPage - 1) })}
                aria-disabled={rolesPage <= 1}
                className={`inline-flex h-10 items-center justify-center rounded-lg border px-3 text-sm ${
                  rolesPage <= 1
                    ? "pointer-events-none border-gray-200 text-gray-400 dark:border-gray-800 dark:text-gray-600"
                    : "border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]"
                }`}
              >
                {t("common.previous")}
              </Link>
              {visibleRolesPages.map((pageNumber) => (
                <Link
                  key={pageNumber}
                  href={buildRolesHref({ rolesPage: pageNumber })}
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-lg text-sm font-medium ${
                    pageNumber === rolesPage
                      ? "bg-brand-500 text-white"
                      : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/[0.03]"
                  }`}
                >
                  {pageNumber}
                </Link>
              ))}
              <Link
                href={buildRolesHref({ rolesPage: Math.min(rolesTotalPages, rolesPage + 1) })}
                aria-disabled={rolesPage >= rolesTotalPages}
                className={`inline-flex h-10 items-center justify-center rounded-lg border px-3 text-sm ${
                  rolesPage >= rolesTotalPages
                    ? "pointer-events-none border-gray-200 text-gray-400 dark:border-gray-800 dark:text-gray-600"
                    : "border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]"
                }`}
              >
                {t("common.next")}
              </Link>
            </div>
          </div>
        </ComponentCard>

        <ComponentCard
          title={t("rbac.permissionMatrixTitle")}
          desc={t("rbac.permissionMatrixDesc")}
          className="2xl:col-span-3"
        >
          <PermissionsFilters
            initialPermQ={permQ}
            initialPermRole={permRole}
            initialPermResource={permResource}
            initialPermPageSize={permPageSize}
            rolesQ={rolesQ}
            rolesPageSize={rolesPageSize}
            rolesPage={rolesPage}
            roleOptions={allRoleCodes}
            resourceOptions={resourceOptions}
            pageSizeOptions={PERM_PAGE_SIZE_OPTIONS}
          />

          <div className="max-w-full overflow-x-auto">
            <div className="min-w-[900px] overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
              <Table>
                <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                  <TableRow>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                      {t("rbac.permissionColumn")}
                    </TableCell>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                      {t("rbac.resourceColumn")}
                    </TableCell>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                      {t("rbac.actionColumn")}
                    </TableCell>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                      {t("rbac.rolesCount")}
                    </TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                  {permissions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                        {t("rbac.noPermissionsFound")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    permissions.map((permission) => (
                      <TableRow key={permission.id}>
                        <TableCell className="px-4 py-3 text-start text-sm font-medium text-gray-700 dark:text-gray-300">
                          {permission.code}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-start text-sm text-gray-700 dark:text-gray-300">
                          {permission.resource}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-start text-sm text-gray-700 dark:text-gray-300">
                          {permission.action}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-start">
                          <div className="flex flex-wrap gap-2">
                            {permission.rolePermissions.length === 0 ? (
                              <span className="text-xs text-gray-400 dark:text-gray-500">{t("rbac.noRole")}</span>
                            ) : (
                              permission.rolePermissions.map((rp) => (
                                <Badge key={rp.id} size="sm" color={badgeForRoleCode(rp.role.code)}>
                                  {translateUserRole(rp.role.code, t)}
                                </Badge>
                              ))
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t("rbac.showingPermissionsSummary", {
                start: permissions.length === 0 ? 0 : (permPage - 1) * permPageSize + 1,
                end: Math.min((permPage - 1) * permPageSize + permissions.length, permissionsFilteredCount),
                total: permissionsFilteredCount,
              })}
            </p>
            <div className="flex items-center gap-2">
              <Link
                href={buildPermissionsHref({ permPage: Math.max(1, permPage - 1) })}
                aria-disabled={permPage <= 1}
                className={`inline-flex h-10 items-center justify-center rounded-lg border px-3 text-sm ${
                  permPage <= 1
                    ? "pointer-events-none border-gray-200 text-gray-400 dark:border-gray-800 dark:text-gray-600"
                    : "border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]"
                }`}
              >
                {t("common.previous")}
              </Link>

              {visiblePermPages.map((pageNumber) => (
                <Link
                  key={pageNumber}
                  href={buildPermissionsHref({ permPage: pageNumber })}
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-lg text-sm font-medium ${
                    pageNumber === permPage
                      ? "bg-brand-500 text-white"
                      : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/[0.03]"
                  }`}
                >
                  {pageNumber}
                </Link>
              ))}

              <Link
                href={buildPermissionsHref({ permPage: Math.min(permissionsTotalPages, permPage + 1) })}
                aria-disabled={permPage >= permissionsTotalPages}
                className={`inline-flex h-10 items-center justify-center rounded-lg border px-3 text-sm ${
                  permPage >= permissionsTotalPages
                    ? "pointer-events-none border-gray-200 text-gray-400 dark:border-gray-800 dark:text-gray-600"
                    : "border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]"
                }`}
              >
                {t("common.next")}
              </Link>
            </div>
          </div>
        </ComponentCard>
      </div>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
      <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
      <h3 className="mt-2 text-2xl font-semibold text-gray-800 dark:text-white/90">{value}</h3>
    </div>
  );
}
