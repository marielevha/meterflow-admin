import { Metadata } from "next";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import ComponentCard from "@/components/common/ComponentCard";
import BillingCreatePanel from "@/components/billing/BillingCreatePanel";
import BillingSchemaNotice from "@/components/billing/BillingSchemaNotice";
import Label from "@/components/form/Label";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { getAdminTranslator } from "@/lib/admin-i18n/server";
import {
  ADMIN_PERMISSION_GROUPS,
  hasAnyPermissionCode,
  requireAdminPermissions,
} from "@/lib/auth/adminPermissions";
import { getCurrentStaffPermissionCodes } from "@/lib/auth/staffServerSession";
import { getBillingPageErrorState } from "@/lib/backoffice/billingPageErrors";
import { prisma } from "@/lib/prisma";
import { createCityAction } from "@/app/(admin)/admin/billing/actions";

export const metadata: Metadata = {
  title: "Billing Cities",
  description: "Manage billing cities",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValue(input: string | string[] | undefined) {
  if (Array.isArray(input)) return input[0] ?? "";
  return input ?? "";
}

export default async function BillingCitiesPage({ searchParams }: { searchParams: SearchParams }) {
  const staff = await requireAdminPermissions("/admin/billing/cities", ADMIN_PERMISSION_GROUPS.billingCitiesView);
  const permissionCodes = await getCurrentStaffPermissionCodes(staff.id);
  const canManageCities = hasAnyPermissionCode(permissionCodes, ADMIN_PERMISSION_GROUPS.billingCitiesManage);
  const { t } = await getAdminTranslator();
  const resolved = await searchParams;
  const error = firstValue(resolved.error);
  const success = firstValue(resolved.success);
  const q = firstValue(resolved.q).trim();

  let cities: Array<{
    id: string;
    code: string;
    name: string;
    region: string | null;
    isActive: boolean;
    _count: { zones: number };
  }> = [];

  try {
    cities = await prisma.city.findMany({
      where: {
        deletedAt: null,
        ...(q
          ? {
              OR: [
                { code: { contains: q, mode: "insensitive" } },
                { name: { contains: q, mode: "insensitive" } },
                { region: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        code: true,
        name: true,
        region: true,
        isActive: true,
        _count: { select: { zones: true } },
      },
      orderBy: [{ name: "asc" }],
    });
  } catch (error) {
    const errorState = getBillingPageErrorState(error, "billing.cities");
    return (
      <div>
        <PageBreadcrumb pageTitle={t("billing.citiesPageTitle")} />
        <BillingSchemaNotice {...errorState} />
      </div>
    );
  }

  return (
    <div>
      <PageBreadcrumb pageTitle={t("billing.citiesPageTitle")} />

      {error ? (
        <div className="mb-4 rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300">
          {t("common.error")}: {error}
        </div>
      ) : null}
      {success ? (
        <div className="mb-4 rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-300">
          {t("common.success")}: {success}
        </div>
      ) : null}

      <div className="space-y-6">
        {canManageCities ? (
          <BillingCreatePanel
            defaultOpen={Boolean(error)}
            title={t("billing.cityCreatePanelTitle")}
            openDescription={t("billing.cityCreateOpenDescription")}
            closedDescription={t("billing.cityCreateClosedDescription")}
            openLabel={t("billing.newCity")}
            closeLabel={t("billing.hideForm")}
          >
            <ComponentCard
              title={t("billing.createCity")}
              desc={t("billing.citiesCardDescription")}
            >
              <form action={createCityAction} className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                <Field label={t("billing.codeLabel")}>
                  <Input name="code" placeholder="CG-CITY-BZV" required />
                </Field>
                <Field label={t("billing.cityName")}>
                  <Input name="name" placeholder="Brazzaville" required />
                </Field>
                <Field label={t("users.region")}>
                  <Input name="region" placeholder="Brazzaville" />
                </Field>
              </div>
              <button
                type="submit"
                className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600"
              >
                {t("billing.createCity")}
              </button>
              </form>
            </ComponentCard>
          </BillingCreatePanel>
        ) : null}

        <ComponentCard title={t("billing.citiesCardTitle")} desc={t("billing.citiesCardDesc")}>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
            <Table className="table-fixed">
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>
                  <TableCell isHeader className="w-[34%] px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                    {t("billing.cityName")}
                  </TableCell>
                  <TableCell isHeader className="w-[28%] px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                    {t("users.region")}
                  </TableCell>
                  <TableCell isHeader className="w-[18%] px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                    {t("billing.zonesCount")}
                  </TableCell>
                  <TableCell isHeader className="w-[20%] px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                    {t("common.status")}
                  </TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {cities.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                      {t("billing.noCitiesYet")}
                    </TableCell>
                  </TableRow>
                ) : (
                  cities.map((city) => (
                    <TableRow key={city.id}>
                      <TableCell className="align-top px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        <p className="break-words font-medium">{city.name}</p>
                        <p className="break-words text-xs text-gray-500 dark:text-gray-400">{city.code}</p>
                      </TableCell>
                      <TableCell className="align-top px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        <span className="break-words">{city.region || t("billing.noRegion")}</span>
                      </TableCell>
                      <TableCell className="align-top px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        {city._count.zones}
                      </TableCell>
                      <TableCell className="align-top px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        {city.isActive ? t("billing.active") : t("billing.inactive")}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </ComponentCard>
      </div>
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
    />
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
