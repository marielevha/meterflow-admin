import { Metadata } from "next";
import { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UserRole, UserStatus } from "@prisma/client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Badge from "@/components/ui/badge/Badge";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import UserEditSelect from "@/components/users/UserEditSelect";
import UserPhoneInput from "@/components/users/UserPhoneInput";
import { EnvelopeIcon, MailIcon, UserIcon } from "@/icons";
import { getAdminTranslator } from "@/lib/admin-i18n/server";
import { translateUserRole, translateUserStatus } from "@/lib/admin-i18n/labels";
import { prisma } from "@/lib/prisma";
import { updateUserAction } from "./actions";

export const metadata: Metadata = {
  title: "Edit User",
  description: "Edit user page",
};

function messageFromError(errorCode: string, t: (key: string) => string) {
  if (errorCode === "phone_required") return t("users.errorPhoneRequired");
  if (errorCode === "invalid_status") return t("users.errorInvalidStatus");
  if (errorCode === "at_least_one_role_required") return t("users.errorAtLeastOneRole");
  if (errorCode === "invalid_role_ids") return t("users.errorInvalidRoleIds");
  if (errorCode === "user_not_found") return t("users.errorUserNotFound");
  if (errorCode === "unique_violation") return t("users.errorUniqueViolation");
  if (errorCode === "update_failed") return t("users.errorUpdateFailed");
  return "";
}

export default async function EditUserPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { t } = await getAdminTranslator();
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const errorCode = Array.isArray(resolvedSearchParams.error)
    ? resolvedSearchParams.error[0]
    : resolvedSearchParams.error || "";

  const user = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    include: {
      roleAssignments: {
        where: { deletedAt: null },
        select: { roleId: true },
      },
    },
  });

  if (!user) {
    notFound();
  }

  const errorMessage = messageFromError(errorCode, t);
  const submit = updateUserAction.bind(null, user.id);
  const fullName =
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || t("users.notAvailableShort");
  const availableRoles = await prisma.role.findMany({
    where: { deletedAt: null },
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true },
  });
  const assignedRoleIds = new Set(user.roleAssignments.map((item) => item.roleId));

  return (
    <div>
      <PageBreadcrumb pageTitle={t("users.editPageTitle")} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <form action={submit} className="xl:col-span-8 space-y-6">
          {errorMessage ? (
            <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300">
              {errorMessage}
            </div>
          ) : null}

          <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="mb-5">
              <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">{t("users.identity")}</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {t("users.identityDescription")}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormInput
                label={t("users.firstName")}
                name="firstName"
                defaultValue={user.firstName || ""}
                icon={<UserIcon />}
              />
              <FormInput
                label={t("users.lastName")}
                name="lastName"
                defaultValue={user.lastName || ""}
                icon={<UserIcon />}
              />
              <FormInput
                label={t("users.username")}
                name="username"
                defaultValue={user.username || ""}
                hint={t("users.uniqueHint")}
                icon={<MailIcon />}
              />
              <FormInput
                label={t("users.email")}
                name="email"
                defaultValue={user.email || ""}
                type="email"
                icon={<EnvelopeIcon />}
              />

              <div className="md:col-span-2">
                <Label>{t("users.phone")}</Label>
                <UserPhoneInput name="phone" defaultValue={user.phone} />
                <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">{t("users.phoneRequired")}</span>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="mb-5">
              <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">{t("users.accessControl")}</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {t("users.accessControlDescription")}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormSelect
                label={t("users.statusLabel")}
                name="status"
                defaultValue={user.status}
                options={Object.values(UserStatus).map((status) => ({
                  value: status,
                  label: translateUserStatus(status, t),
                }))}
                placeholder={t("userFilters.allStatuses")}
              />
            </div>

            <div className="mt-5">
              <Label>{t("users.assignedRoles")}</Label>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {availableRoles.map((role) => (
                  <label
                    key={role.id}
                    className="flex items-start gap-3 rounded-lg border border-gray-200 px-3 py-2 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-white/[0.03]"
                  >
                    <input
                      type="checkbox"
                      name="roleIds"
                      value={role.id}
                      defaultChecked={assignedRoleIds.has(role.id)}
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500/30 dark:border-gray-700"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      <span className="font-medium">{translateUserRole(role.code, t)}</span> - {role.name}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="mb-5">
              <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">{t("meters.location")}</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {t("users.locationDescription")}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <FormInput label={t("users.region")} name="region" defaultValue={user.region || ""} />
              <FormInput label={t("users.city")} name="city" defaultValue={user.city || ""} icon={<UserIcon />} />
              <FormInput label={t("users.zone")} name="zone" defaultValue={user.zone || ""} icon={<UserIcon />} />
            </div>
          </section>

          <div className="sticky bottom-4 z-30 rounded-xl border border-gray-200 bg-white/90 p-4 backdrop-blur dark:border-gray-800 dark:bg-gray-900/90">
            <div className="flex items-center justify-end gap-2">
              <Link
                href={`/admin/users/${user.id}`}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]"
              >
                {t("common.cancel")}
              </Link>
              <button
                type="submit"
                className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600"
              >
                {t("users.saveChanges")}
              </button>
            </div>
          </div>
        </form>

        <aside className="xl:col-span-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] xl:sticky xl:top-24">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("users.editingUser")}</p>
                <h3 className="mt-1 text-lg font-semibold text-gray-800 dark:text-white/90">{fullName}</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{user.email || user.phone}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300 flex items-center justify-center text-sm font-bold">
                {initials(user.firstName || "", user.lastName || "", user.username || "")}
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <Badge size="sm" color={badgeForRole(user.role)}>
                {translateUserRole(user.role, t)}
              </Badge>
              <Badge size="sm" color={badgeForStatus(user.status)}>
                {translateUserStatus(user.status, t)}
              </Badge>
            </div>

            <div className="mt-6 space-y-3">
              <InfoRow label={t("users.userId")} value={user.id} breakAll />
              <InfoRow label={t("users.createdColumn")} value={formatDate(user.createdAt, t("users.notAvailableShort"))} />
              <InfoRow label={t("users.activatedAt")} value={formatDate(user.activatedAt, t("users.notAvailableShort"))} />
              <InfoRow label={t("users.lastLoginAt")} value={formatDate(user.lastLoginAt, t("users.notAvailableShort"))} />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function initials(firstName: string, lastName: string, username: string) {
  const first = firstName.trim()?.[0] ?? "";
  const last = lastName.trim()?.[0] ?? "";
  const userSeed = username.trim()?.[0] ?? "";
  return (first + last || userSeed || "U").toUpperCase();
}

function badgeForRole(role: UserRole) {
  if (role === UserRole.ADMIN) return "error" as const;
  if (role === UserRole.SUPERVISOR) return "warning" as const;
  if (role === UserRole.AGENT) return "info" as const;
  return "success" as const;
}

function badgeForStatus(status: UserStatus) {
  if (status === UserStatus.ACTIVE) return "success" as const;
  if (status === UserStatus.SUSPENDED) return "error" as const;
  return "warning" as const;
}

function formatDate(value: Date | null, fallback: string) {
  if (!value) return fallback;
  return value.toISOString().slice(0, 19).replace("T", " ");
}

function FormInput({
  label,
  name,
  defaultValue,
  type = "text",
  required = false,
  hint,
  icon,
}: {
  label: string;
  name: string;
  defaultValue: string;
  type?: string;
  required?: boolean;
  hint?: string;
  icon?: ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      <div className="relative">
        <Input
          type={type}
          id={name}
          name={name}
          defaultValue={defaultValue}
          required={required}
          className={icon ? "pl-[62px]" : ""}
        />
        {icon ? (
          <span className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 border-r border-gray-200 px-3.5 py-3 text-gray-500 dark:border-gray-800 dark:text-gray-400">
            {icon}
          </span>
        ) : null}
      </div>
      {hint ? <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">{hint}</span> : null}
    </div>
  );
}

function FormSelect({
  label,
  name,
  defaultValue,
  options,
}: {
  label: string;
  name: string;
  defaultValue: string;
  options: Array<string | { value: string; label: string }>;
  placeholder?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <UserEditSelect name={name} defaultValue={defaultValue} options={options} placeholder={placeholder} />
    </div>
  );
}

function InfoRow({
  label,
  value,
  breakAll = false,
}: {
  label: string;
  value: string;
  breakAll?: boolean;
}) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-white/[0.02]">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`mt-1 text-sm font-medium text-gray-800 dark:text-white/90 ${breakAll ? "break-all" : ""}`}>
        {value}
      </p>
    </div>
  );
}
