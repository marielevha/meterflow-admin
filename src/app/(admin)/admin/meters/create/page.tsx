import { Metadata } from "next";
import Link from "next/link";
import { MeterStatus, MeterType, UserRole } from "@prisma/client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import SearchableSelect from "@/components/form/SearchableSelect";
import { translateMeterStatus, translateMeterType } from "@/lib/admin-i18n/labels";
import { getAdminTranslator } from "@/lib/admin-i18n/server";
import { ADMIN_PERMISSION_GROUPS, requireAdminPermissions } from "@/lib/auth/adminPermissions";
import { prisma } from "@/lib/prisma";
import { createMeterAction } from "./actions";

export const metadata: Metadata = {
  title: "Add Meter",
  description: "Create meter page",
};

function messageFromError(errorCode: string, t: (key: string) => string) {
  if (errorCode === "required_fields") return t("meters.errorRequiredFields");
  if (errorCode === "invalid_type") return t("meters.errorInvalidType");
  if (errorCode === "invalid_status") return t("meters.errorInvalidStatus");
  if (errorCode === "unique_violation") return t("meters.errorUniqueViolation");
  if (errorCode === "create_failed") return t("meters.errorCreateFailed");
  return "";
}

function toInputDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

export default async function CreateMeterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPermissions("/admin/meters/create", ADMIN_PERMISSION_GROUPS.metersCreate);
  const { t } = await getAdminTranslator();
  const resolvedSearchParams = await searchParams;
  const errorCode = Array.isArray(resolvedSearchParams.error)
    ? resolvedSearchParams.error[0]
    : resolvedSearchParams.error || "";
  const errorMessage = messageFromError(errorCode, t);

  const [customers, agents] = await prisma.$transaction([
    prisma.user.findMany({
      where: {
        deletedAt: null,
        role: UserRole.CLIENT,
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
      },
    }),
    prisma.user.findMany({
      where: {
        deletedAt: null,
        role: {
          in: [UserRole.AGENT, UserRole.SUPERVISOR, UserRole.ADMIN],
        },
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
      },
    }),
  ]);

  const customerOptions = customers.map((customer) => {
    const name = [customer.firstName, customer.lastName].filter(Boolean).join(" ").trim();
    return {
      value: customer.id,
      label: name || t("common.customer"),
      hint: customer.phone,
    };
  });

  const agentOptions = agents.map((agent) => {
    const name = [agent.firstName, agent.lastName].filter(Boolean).join(" ").trim();
    return {
      value: agent.id,
      label: name || t("users.roleAgent"),
      hint: agent.phone,
    };
  });

  return (
    <div>
      <PageBreadcrumb pageTitle={t("meters.createPageTitle")} />

      <form action={createMeterAction} className="space-y-6">
        {errorMessage ? (
          <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300">
            {errorMessage}
          </div>
        ) : null}

        <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="mb-5">
            <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">{t("meters.meterIdentity")}</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t("meters.identityDescription")}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <FormInput label={t("meters.serialNumber")} name="serialNumber" defaultValue="" />
            <FormInput label={t("meters.reference")} name="meterReference" defaultValue="" />

            <div>
              <Label htmlFor="type">{t("common.type")}</Label>
              <select
                id="type"
                name="type"
                defaultValue={MeterType.SINGLE_INDEX}
                className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
              >
                {Object.values(MeterType).map((item) => (
                  <option key={item} value={item}>
                    {translateMeterType(item, t)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="status">{t("common.status")}</Label>
              <select
                id="status"
                name="status"
                defaultValue={MeterStatus.ACTIVE}
                className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
              >
                {Object.values(MeterStatus).map((item) => (
                  <option key={item} value={item}>
                    {translateMeterStatus(item, t)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="mb-5">
            <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">{t("meters.assignment")}</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("meters.assignmentDescription")}</p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="customerId">{t("common.customer")}</Label>
              <SearchableSelect
                id="customerId"
                name="customerId"
                options={customerOptions}
                placeholder={t("meters.searchCustomerPlaceholder")}
                emptyLabel={t("meters.unassigned")}
              />
            </div>

            <div>
              <Label htmlFor="assignedAgentId">{t("meters.assignedAgent")}</Label>
              <SearchableSelect
                id="assignedAgentId"
                name="assignedAgentId"
                options={agentOptions}
                placeholder={t("meters.searchAgentPlaceholder")}
                emptyLabel={t("meters.unassigned")}
              />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="mb-5">
            <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">{t("meters.location")}</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("meters.locationDescription")}</p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <FormInput label={t("meters.addressLine1")} name="addressLine1" defaultValue="" />
            <FormInput label={t("meters.addressLine2")} name="addressLine2" defaultValue="" />
            <FormInput label={t("users.city")} name="city" defaultValue="" />
            <FormInput label={t("users.zone")} name="zone" defaultValue="" />
            <FormInput label={t("meters.latitude")} name="latitude" defaultValue="" />
            <FormInput label={t("meters.longitude")} name="longitude" defaultValue="" />
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="mb-5">
            <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">{t("meters.timeline")}</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("meters.timelineDescription")}</p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormInput
              label={t("meters.installedAt")}
              name="installedAt"
              type="date"
              defaultValue={toInputDate(new Date())}
            />
            <FormInput label={t("meters.lastInspection")} name="lastInspectionAt" type="date" defaultValue="" />
          </div>
        </section>

        <div className="sticky bottom-4 z-30 rounded-xl border border-gray-200 bg-white/90 p-4 backdrop-blur dark:border-gray-800 dark:bg-gray-900/90">
          <div className="flex items-center justify-end gap-2">
            <Link
              href="/admin/meters"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]"
            >
              {t("common.cancel")}
            </Link>
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600"
            >
              {t("meters.createSubmit")}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function FormInput({
  label,
  name,
  defaultValue,
  type = "text",
}: {
  label: string;
  name: string;
  defaultValue: string;
  type?: string;
}) {
  return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} defaultValue={defaultValue} />
    </div>
  );
}
