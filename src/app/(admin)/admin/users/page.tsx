import { Metadata } from "next";
import Link from "next/link";
import { Prisma, UserRole, UserStatus } from "@prisma/client";
import ComponentCard from "@/components/common/ComponentCard";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Badge from "@/components/ui/badge/Badge";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import UsersFilters from "@/components/users/UsersFilters";
import ImportUsersModal from "@/components/users/ImportUsersModal";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Users",
  description: "User management page for dashboard",
};

const STAFF_ROLES: UserRole[] = [UserRole.AGENT, UserRole.SUPERVISOR, UserRole.ADMIN];
const PAGE_SIZE_OPTIONS = [10, 20, 50];

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValue(input: string | string[] | undefined): string {
  if (Array.isArray(input)) return input[0] ?? "";
  return input ?? "";
}

function normalizeRole(value: string): UserRole | "" {
  return (Object.values(UserRole) as string[]).includes(value) ? (value as UserRole) : "";
}

function normalizeStatus(value: string): UserStatus | "" {
  return (Object.values(UserStatus) as string[]).includes(value) ? (value as UserStatus) : "";
}

function initials(firstName?: string | null, lastName?: string | null, username?: string | null) {
  const first = firstName?.trim()?.[0] ?? "";
  const last = lastName?.trim()?.[0] ?? "";
  const seed = username?.trim()?.[0] ?? "";
  return (first + last || seed || "U").toUpperCase();
}

function displayName(user: {
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  email?: string | null;
  phone: string;
}) {
  const first = user.firstName?.trim() ?? "";
  const last = user.lastName?.trim() ?? "";
  if (first || last) return `${first} ${last}`.trim();
  return user.username || user.email || user.phone;
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function badgeForRole(role: UserRole) {
  if (role === UserRole.ADMIN) return { color: "error" as const, label: "ADMIN" };
  if (role === UserRole.SUPERVISOR) return { color: "warning" as const, label: "SUPERVISOR" };
  if (role === UserRole.AGENT) return { color: "info" as const, label: "AGENT" };
  return { color: "success" as const, label: "CLIENT" };
}

function badgeForStatus(status: UserStatus) {
  if (status === UserStatus.ACTIVE) return { color: "success" as const, label: "ACTIVE" };
  if (status === UserStatus.SUSPENDED) return { color: "error" as const, label: "SUSPENDED" };
  return { color: "warning" as const, label: "PENDING" };
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const resolvedSearchParams = await searchParams;

  const q = firstValue(resolvedSearchParams.q).trim();
  const role = normalizeRole(firstValue(resolvedSearchParams.role).trim());
  const status = normalizeStatus(firstValue(resolvedSearchParams.status).trim());
  const pageSizeRaw = Number(firstValue(resolvedSearchParams.pageSize) || "10");
  const pageSize = PAGE_SIZE_OPTIONS.includes(pageSizeRaw) ? pageSizeRaw : 10;
  const requestedPage = Math.max(1, Number(firstValue(resolvedSearchParams.page) || "1"));

  const where: Prisma.UserWhereInput = {
    deletedAt: null,
    ...(role ? { role } : {}),
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { phone: { contains: q } },
            { username: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [totalFiltered, totalUsers, totalActiveUsers, totalPendingUsers, totalStaffUsers] =
    await prisma.$transaction([
      prisma.user.count({ where }),
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.user.count({ where: { deletedAt: null, status: UserStatus.ACTIVE } }),
      prisma.user.count({ where: { deletedAt: null, status: UserStatus.PENDING } }),
      prisma.user.count({ where: { deletedAt: null, role: { in: STAFF_ROLES } } }),
    ]);

  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const skip = (page - 1) * pageSize;

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip,
    take: pageSize,
    select: {
      id: true,
      phone: true,
      username: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      status: true,
      city: true,
      zone: true,
      createdAt: true,
      lastLoginAt: true,
    },
  });

  const buildHref = (overrides: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    const nextQ = overrides.q ?? q;
    const nextRole = overrides.role ?? role;
    const nextStatus = overrides.status ?? status;
    const nextPageSize = overrides.pageSize ?? pageSize;
    const nextPage = overrides.page ?? page;

    if (nextQ) params.set("q", String(nextQ));
    if (nextRole) params.set("role", String(nextRole));
    if (nextStatus) params.set("status", String(nextStatus));
    if (nextPageSize) params.set("pageSize", String(nextPageSize));
    if (nextPage && Number(nextPage) > 1) params.set("page", String(nextPage));

    const query = params.toString();
    return query ? `/admin/users?${query}` : "/admin/users";
  };

  const startPage = Math.max(1, page - 2);
  const endPage = Math.min(totalPages, startPage + 4);
  const visiblePages = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);

  return (
    <div>
      <PageBreadcrumb pageTitle="Users" />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total users</p>
          <h3 className="mt-2 text-2xl font-semibold text-gray-800 dark:text-white/90">{totalUsers}</h3>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <p className="text-sm text-gray-500 dark:text-gray-400">Active users</p>
          <h3 className="mt-2 text-2xl font-semibold text-gray-800 dark:text-white/90">{totalActiveUsers}</h3>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <p className="text-sm text-gray-500 dark:text-gray-400">Pending users</p>
          <h3 className="mt-2 text-2xl font-semibold text-gray-800 dark:text-white/90">{totalPendingUsers}</h3>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <p className="text-sm text-gray-500 dark:text-gray-400">Staff users</p>
          <h3 className="mt-2 text-2xl font-semibold text-gray-800 dark:text-white/90">{totalStaffUsers}</h3>
        </div>
      </div>

      <div className="mb-4 flex justify-end">
        <ImportUsersModal />
      </div>

      <ComponentCard
        title="User directory"
        desc="Recherche, filtrage et suivi des comptes utilisateurs."
      >
        <UsersFilters
          initialQ={q}
          initialRole={role}
          initialStatus={status}
          initialPageSize={pageSize}
          roleOptions={Object.values(UserRole)}
          statusOptions={Object.values(UserStatus)}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
        />

        <div className="max-w-full overflow-x-auto">
          <div className="min-w-[1240px] overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>
                  <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                    User
                  </TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                    Contact
                  </TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                    Role
                  </TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                    Status
                  </TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                    Location
                  </TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                    Created
                  </TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                    Last login
                  </TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                    Actions
                  </TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell className="px-5 py-8 text-center text-sm text-gray-500 dark:text-gray-400" colSpan={8}>
                      No users found for current filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => {
                    const roleBadge = badgeForRole(user.role);
                    const statusBadge = badgeForStatus(user.status);
                    return (
                      <TableRow key={user.id}>
                        <TableCell className="px-5 py-4 text-start">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                              <span className="text-sm font-semibold">
                                {initials(user.firstName, user.lastName, user.username)}
                              </span>
                            </div>
                            <div>
                              <p className="text-theme-sm font-medium text-gray-800 dark:text-white/90">
                                {displayName(user)}
                              </p>
                              <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                                {user.username ? `@${user.username}` : "No username"}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="px-5 py-4 text-start text-theme-sm text-gray-600 dark:text-gray-300">
                          <p>{user.email || "No email"}</p>
                          <p className="text-theme-xs text-gray-500 dark:text-gray-400">{user.phone}</p>
                        </TableCell>
                        <TableCell className="px-5 py-4 text-start">
                          <Badge size="sm" color={roleBadge.color}>
                            {roleBadge.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-5 py-4 text-start">
                          <Badge size="sm" color={statusBadge.color}>
                            {statusBadge.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-5 py-4 text-start text-theme-sm text-gray-600 dark:text-gray-300">
                          {user.city || user.zone ? `${user.city || "-"} / ${user.zone || "-"}` : "N/A"}
                        </TableCell>
                        <TableCell className="px-5 py-4 text-start text-theme-sm text-gray-600 dark:text-gray-300">
                          {formatDate(user.createdAt)}
                        </TableCell>
                        <TableCell className="px-5 py-4 text-start text-theme-sm text-gray-600 dark:text-gray-300">
                          {user.lastLoginAt ? formatDate(user.lastLoginAt) : "Never"}
                        </TableCell>
                        <TableCell className="px-5 py-4 text-start">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/admin/users/${user.id}`}
                              className="inline-flex h-8 items-center rounded-md border border-gray-300 px-3 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]"
                            >
                              View
                            </Link>
                            <Link
                              href={`/admin/users/${user.id}/edit`}
                              className="inline-flex h-8 items-center rounded-md border border-gray-300 px-3 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]"
                            >
                              Edit
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Showing {users.length === 0 ? 0 : skip + 1} - {Math.min(skip + users.length, totalFiltered)} of{" "}
            {totalFiltered} users
          </p>
          <div className="flex items-center gap-2">
            <Link
              href={buildHref({ page: page - 1 })}
              aria-disabled={page <= 1}
              className={`inline-flex h-10 items-center justify-center rounded-lg border px-3 text-sm ${
                page <= 1
                  ? "pointer-events-none border-gray-200 text-gray-400 dark:border-gray-800 dark:text-gray-600"
                  : "border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]"
              }`}
            >
              Previous
            </Link>

            {visiblePages.map((pageNumber) => (
              <Link
                key={pageNumber}
                href={buildHref({ page: pageNumber })}
                className={`inline-flex h-10 w-10 items-center justify-center rounded-lg text-sm font-medium ${
                  pageNumber === page
                    ? "bg-brand-500 text-white"
                    : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/[0.03]"
                }`}
              >
                {pageNumber}
              </Link>
            ))}

            <Link
              href={buildHref({ page: page + 1 })}
              aria-disabled={page >= totalPages}
              className={`inline-flex h-10 items-center justify-center rounded-lg border px-3 text-sm ${
                page >= totalPages
                  ? "pointer-events-none border-gray-200 text-gray-400 dark:border-gray-800 dark:text-gray-600"
                  : "border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]"
              }`}
            >
              Next
            </Link>
          </div>
        </div>
      </ComponentCard>
    </div>
  );
}
