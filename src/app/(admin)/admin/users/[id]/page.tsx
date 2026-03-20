import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UserRole, UserStatus } from "@prisma/client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Badge from "@/components/ui/badge/Badge";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "User Details",
  description: "User details page",
};

function formatDate(value: Date | null) {
  if (!value) return "N/A";
  return value.toISOString().slice(0, 19).replace("T", " ");
}

function roleBadge(role: UserRole) {
  if (role === UserRole.ADMIN) return "error" as const;
  if (role === UserRole.SUPERVISOR) return "warning" as const;
  if (role === UserRole.AGENT) return "info" as const;
  return "success" as const;
}

function statusBadge(status: UserStatus) {
  if (status === UserStatus.ACTIVE) return "success" as const;
  if (status === UserStatus.SUSPENDED) return "error" as const;
  return "warning" as const;
}

export default async function UserDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await prisma.user.findFirst({
    where: { id, deletedAt: null },
  });

  if (!user) {
    notFound();
  }

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || "N/A";

  return (
    <div>
      <PageBreadcrumb pageTitle="User details" />

      <div className="mb-6 flex items-center justify-end gap-2">
        <Link
          href="/admin/users"
          className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]"
        >
          Back
        </Link>
        <Link
          href={`/admin/users/${user.id}/edit`}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600"
        >
          Edit user
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <p className="text-sm text-gray-500 dark:text-gray-400">User ID</p>
          <p className="mt-2 break-all text-sm text-gray-800 dark:text-white/90">{user.id}</p>
          <div className="mt-4 flex items-center gap-2">
            <Badge size="sm" color={roleBadge(user.role)}>
              {user.role}
            </Badge>
            <Badge size="sm" color={statusBadge(user.status)}>
              {user.status}
            </Badge>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] lg:col-span-2">
          <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Identity</h3>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Full name" value={fullName} />
            <Field label="Username" value={user.username || "N/A"} />
            <Field label="Email" value={user.email || "N/A"} />
            <Field label="Phone" value={user.phone} />
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] lg:col-span-3">
          <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Location & timeline</h3>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Field label="Region" value={user.region || "N/A"} />
            <Field label="City" value={user.city || "N/A"} />
            <Field label="Zone" value={user.zone || "N/A"} />
            <Field label="Activated at" value={formatDate(user.activatedAt)} />
            <Field label="Last login at" value={formatDate(user.lastLoginAt)} />
            <Field label="Created at" value={formatDate(user.createdAt)} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-white/[0.02]">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-gray-800 dark:text-white/90">{value}</p>
    </div>
  );
}
