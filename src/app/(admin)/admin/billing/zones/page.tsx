import { Metadata } from "next";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import ComponentCard from "@/components/common/ComponentCard";
import BillingCreatePanel from "@/components/billing/BillingCreatePanel";
import BillingSchemaNotice from "@/components/billing/BillingSchemaNotice";
import Label from "@/components/form/Label";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { getAdminTranslator } from "@/lib/admin-i18n/server";
import { ADMIN_PERMISSION_GROUPS, requireAdminPermissions } from "@/lib/auth/adminPermissions";
import { getBillingPageErrorState } from "@/lib/backoffice/billingPageErrors";
import { prisma } from "@/lib/prisma";
import { createZoneAction } from "@/app/(admin)/admin/billing/actions";

export const metadata: Metadata = {
  title: "Billing Zones",
  description: "Manage billing service zones",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValue(input: string | string[] | undefined) {
  if (Array.isArray(input)) return input[0] ?? "";
  return input ?? "";
}

export default async function BillingZonesPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdminPermissions("/admin/billing/zones", ADMIN_PERMISSION_GROUPS.billingZonesManage);
  const { t } = await getAdminTranslator();
  const resolved = await searchParams;
  const error = firstValue(resolved.error);
  const success = firstValue(resolved.success);

  let zones: Array<{
    id: string;
    code: string;
    name: string;
    city: { id: string; code: string; name: string; region: string | null };
    isActive: boolean;
    _count: { meters: number; tariffPlans: number; campaignAssignments: number };
  }> = [];
  let cities: Array<{ id: string; code: string; name: string; region: string | null }> = [];

  try {
    [zones, cities] = await prisma.$transaction([
      prisma.zone.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          code: true,
          name: true,
          city: { select: { id: true, code: true, name: true, region: true } },
          isActive: true,
          _count: { select: { meters: true, tariffPlans: true, campaignAssignments: true } },
        },
        orderBy: [{ city: { name: "asc" } }, { name: "asc" }],
      }),
      prisma.city.findMany({
        where: { deletedAt: null, isActive: true },
        select: { id: true, code: true, name: true, region: true },
        orderBy: [{ name: "asc" }],
      }),
    ]);
  } catch (error) {
    const errorState = getBillingPageErrorState(error, "billing.zones");
    return (
      <div>
        <PageBreadcrumb pageTitle={t("billing.zonesPageTitle")} />
        <BillingSchemaNotice {...errorState} />
      </div>
    );
  }

  return (
    <div>
      <PageBreadcrumb pageTitle={t("billing.zonesPageTitle")} />

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
        <BillingCreatePanel
          defaultOpen={Boolean(error)}
          title={t("billing.zoneCreatePanelTitle")}
          openDescription={t("billing.zoneCreateOpenDescription")}
          closedDescription={t("billing.zoneCreateClosedDescription")}
          openLabel={t("billing.newZone")}
          closeLabel={t("billing.hideForm")}
        >
          <ComponentCard
            title={t("billing.createZone")}
            desc={t("billing.zonesCardDescription")}
          >
            <form action={createZoneAction} className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                <Field label={t("billing.codeLabel")}>
                  <Input name="code" placeholder="CG-BZV-BCG" required />
                </Field>
                <Field label={t("billing.zoneName")}>
                  <Input name="name" placeholder="Bacongo" required />
                </Field>
                <Field label={t("billing.cityName")}>
                  <select
                    name="cityId"
                    className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                    required
                  >
                    <option value="">{t("billing.chooseCity")}</option>
                    {cities.map((city) => (
                      <option key={city.id} value={city.id}>
                        {city.name}
                        {city.region ? ` (${city.region})` : ""}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <button
                type="submit"
                className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600"
              >
                {t("billing.createZone")}
              </button>
            </form>
          </ComponentCard>
        </BillingCreatePanel>

        <ComponentCard
          title={t("billing.zonesCardTitle")}
          desc={t("billing.zonesCardDesc")}
        >
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
              <Table className="table-fixed">
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>
                    <TableCell isHeader className="w-[28%] px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">{t("billing.zoneName")}</TableCell>
                    <TableCell isHeader className="w-[28%] px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">{t("billing.cityName")}</TableCell>
                    <TableCell isHeader className="w-[11%] px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">{t("billing.metersCount")}</TableCell>
                    <TableCell isHeader className="w-[11%] px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">{t("billing.tariffsCount")}</TableCell>
                    <TableCell isHeader className="w-[12%] px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">{t("billing.statCampaigns")}</TableCell>
                    <TableCell isHeader className="w-[10%] px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">{t("common.status")}</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                  {zones.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                        {t("billing.noZonesYet")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    zones.map((zone) => (
                      <TableRow key={zone.id}>
                        <TableCell className="align-top px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          <p className="break-words font-medium">{zone.name}</p>
                          <p className="break-words text-xs text-gray-500 dark:text-gray-400">{zone.code}</p>
                        </TableCell>
                        <TableCell className="align-top px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          <p className="break-words">{zone.city.name}</p>
                          <p className="break-words text-xs text-gray-500 dark:text-gray-400">{zone.city.region || t("billing.noRegion")}</p>
                        </TableCell>
                        <TableCell className="align-top px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{zone._count.meters}</TableCell>
                        <TableCell className="align-top px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{zone._count.tariffPlans}</TableCell>
                        <TableCell className="align-top px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{zone._count.campaignAssignments}</TableCell>
                        <TableCell className="align-top px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          {zone.isActive ? t("billing.active") : t("billing.inactive")}
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
