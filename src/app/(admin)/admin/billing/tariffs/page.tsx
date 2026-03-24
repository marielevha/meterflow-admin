import { Metadata } from "next";
import { Prisma, TariffBillingMode } from "@prisma/client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import ComponentCard from "@/components/common/ComponentCard";
import BillingCreatePanel from "@/components/billing/BillingCreatePanel";
import BillingSchemaNotice from "@/components/billing/BillingSchemaNotice";
import TariffPlanStatusSwitch from "@/components/billing/TariffPlanStatusSwitch";
import Label from "@/components/form/Label";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import {
  translateTariffBillingMode,
} from "@/lib/admin-i18n/labels";
import { getAdminTranslator } from "@/lib/admin-i18n/server";
import { getBillingPageErrorState } from "@/lib/backoffice/billingPageErrors";
import { prisma } from "@/lib/prisma";
import { createTariffPlanAction } from "@/app/(admin)/admin/billing/actions";

export const metadata: Metadata = {
  title: "Billing Tariffs",
  description: "Manage tariff plans",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type TariffPlanRow = Prisma.TariffPlanGetPayload<{
  include: {
    serviceZone: {
      select: {
        id: true;
        code: true;
        name: true;
        city: { select: { id: true; code: true; name: true; region: true } };
      };
    };
    taxes: {
      where: { deletedAt: null; taxRule: { deletedAt: null } };
      include: {
        taxRule: {
          select: {
            id: true;
            code: true;
            name: true;
            type: true;
            applicationScope: true;
            value: true;
          };
        };
      };
      orderBy: { sortOrder: "asc" };
    };
    _count: { select: { invoices: true; campaigns: true } };
  };
}>;

function firstValue(input: string | string[] | undefined) {
  if (Array.isArray(input)) return input[0] ?? "";
  return input ?? "";
}

export default async function BillingTariffsPage({ searchParams }: { searchParams: SearchParams }) {
  const { t } = await getAdminTranslator();
  const resolved = await searchParams;
  const error = firstValue(resolved.error);
  const success = firstValue(resolved.success);

  let plans: TariffPlanRow[] = [];
  let zones: Array<{
    id: string;
    code: string;
    name: string;
    city: { id: string; code: string; name: string; region: string | null };
  }> = [];
  try {
    [plans, zones] = await prisma.$transaction([
      prisma.tariffPlan.findMany({
        where: { deletedAt: null },
        include: {
          serviceZone: {
            select: {
              id: true,
              code: true,
              name: true,
              city: { select: { id: true, code: true, name: true, region: true } },
            },
          },
          taxes: {
            where: { deletedAt: null, taxRule: { deletedAt: null } },
            include: {
              taxRule: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  type: true,
                  applicationScope: true,
                  value: true,
                },
              },
            },
            orderBy: { sortOrder: "asc" },
          },
          _count: { select: { invoices: true, campaigns: true } },
        },
        orderBy: [{ isDefault: "desc" }, { code: "asc" }, { createdAt: "asc" }],
      }),
      prisma.zone.findMany({
        where: { deletedAt: null, isActive: true },
        select: {
          id: true,
          code: true,
          name: true,
          city: { select: { id: true, code: true, name: true, region: true } },
        },
        orderBy: [{ city: { name: "asc" } }, { name: "asc" }],
      }),
    ]);
  } catch (error) {
    const errorState = getBillingPageErrorState(error, "billing.tariffs");
    return (
      <div>
        <PageBreadcrumb pageTitle={t("billing.tariffsPageTitle")} />
        <BillingSchemaNotice {...errorState} />
      </div>
    );
  }

  return (
    <div>
      <PageBreadcrumb pageTitle={t("billing.tariffsPageTitle")} />

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
          title={t("billing.tariffCreatePanelTitle")}
          openDescription={t("billing.tariffCreateOpenDescription")}
          closedDescription={t("billing.tariffCreateClosedDescription")}
          openLabel={t("billing.newTariff")}
          closeLabel={t("billing.hideForm")}
        >
          <ComponentCard
            title={t("billing.createTariffCardTitle")}
            desc={t("billing.createTariffCardDesc")}
          >
            <form action={createTariffPlanAction} className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Field label={t("billing.codeLabel")}>
                  <Input name="code" placeholder="CG-BZV-BAC-TOU-2026" required />
                </Field>
                <Field label={t("billing.planName")}>
                  <Input name="name" placeholder="Bacongo HP/HC 2026" required />
                </Field>
                <Field label={t("billing.zoneLabel")}>
                  <select
                    name="zoneId"
                    className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                  >
                    <option value="">{t("billing.globalOption")}</option>
                    {zones.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                        {zone.city.name} - {zone.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t("billing.billingMode")}>
                  <select
                    name="billingMode"
                    defaultValue={TariffBillingMode.SINGLE_RATE}
                    className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                  >
                    <option value={TariffBillingMode.SINGLE_RATE}>{t("billing.singleRate")}</option>
                    <option value={TariffBillingMode.TIME_OF_USE}>{t("billing.timeOfUse")}</option>
                  </select>
                </Field>
                <Field label={t("billing.currencyLabel")}>
                  <Input name="currency" placeholder="XAF" defaultValue="XAF" />
                </Field>
                <Field label={t("billing.fixedCharge")}>
                  <Input name="fixedCharge" type="number" step="0.01" placeholder="1500" defaultValue="0" />
                </Field>
                <Field label={t("billing.baseTaxPercent")}>
                  <Input name="taxPercent" type="number" step="0.01" placeholder="18" defaultValue="0" />
                </Field>
                <Field label={t("billing.lateFeePercent")}>
                  <Input name="lateFeePercent" type="number" step="0.01" placeholder="5" defaultValue="0" />
                </Field>
                <Field label={t("billing.singleUnitPrice")}>
                  <Input name="singleUnitPrice" type="number" step="0.001" placeholder="95" />
                </Field>
                <Field label={t("billing.hpUnitPrice")}>
                  <Input name="hpUnitPrice" type="number" step="0.001" placeholder="110" />
                </Field>
                <Field label={t("billing.hcUnitPrice")}>
                  <Input name="hcUnitPrice" type="number" step="0.001" placeholder="75" />
                </Field>
                <Field label={t("billing.effectiveFrom")}>
                  <Input name="effectiveFrom" type="datetime-local" />
                </Field>
                <Field label={t("billing.effectiveTo")}>
                  <Input name="effectiveTo" type="datetime-local" />
                </Field>
              </div>

              <Field label={t("common.description")}>
                <textarea
                  name="description"
                  rows={2}
                  placeholder={t("common.noDescription")}
                  className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                />
              </Field>

              <Field label={t("billing.additionalTaxRules")}>
                <textarea
                  name="taxes"
                  rows={4}
                  placeholder={"TVA-AUDIO-BAC,Taxe audiovisuelle,PERCENT,SUBTOTAL,2.5\\nREDEVANCE-CNT,Redevance locale,FIXED,SUBTOTAL,500"}
                  className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 font-mono text-xs text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                />
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  {t("billing.additionalTaxRulesHint")}
                </p>
              </Field>

              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-600 dark:border-gray-800 dark:bg-white/[0.02] dark:text-gray-400">
                {t("billing.tariffPricingHint")}
              </div>

              <div>
                <Label>{t("billing.defaultPlan")}</Label>
                <label className="mt-2 inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input type="checkbox" name="isDefault" className="h-4 w-4" /> {t("billing.setAsDefaultFallback")}
                </label>
              </div>

              <button
                type="submit"
                className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600"
              >
                {t("billing.createTariff")}
              </button>
            </form>
          </ComponentCard>
        </BillingCreatePanel>

        <ComponentCard
          title={t("billing.tariffsCardTitle")}
          desc={t("billing.tariffsCardDesc")}
        >
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
              <Table className="table-fixed">
                <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                  <TableRow>
                    <TableCell isHeader className="w-[18%] px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">{t("billing.planColumn")}</TableCell>
                    <TableCell isHeader className="w-[16%] px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">{t("billing.zoneLabel")}</TableCell>
                    <TableCell isHeader className="w-[18%] px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">{t("billing.pricingColumn")}</TableCell>
                    <TableCell isHeader className="w-[22%] px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">{t("billing.taxesColumn")}</TableCell>
                    <TableCell isHeader className="w-[14%] px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">{t("billing.usageColumn")}</TableCell>
                    <TableCell isHeader className="w-[7%] px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">{t("billing.statusColumn")}</TableCell>
                    <TableCell isHeader className="w-[5%] px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">{t("common.actions")}</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                  {plans.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                        {t("billing.noPlansYet")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    plans.map((plan) => (
                      <TableRow key={plan.id}>
                        <TableCell className="align-top px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          <p className="break-words font-medium">{plan.code}</p>
                          <p className="break-words text-xs text-gray-500 dark:text-gray-400">{plan.name}</p>
                          {plan.description ? (
                            <p className="mt-1 break-words text-xs text-gray-500 dark:text-gray-400">{plan.description}</p>
                          ) : null}
                        </TableCell>
                        <TableCell className="align-top px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          {plan.serviceZone ? (
                            <>
                              <p className="break-words font-medium">{plan.serviceZone.city.name}</p>
                              <p className="break-words text-xs text-gray-500 dark:text-gray-400">
                                {plan.serviceZone.name} ({plan.serviceZone.code})
                              </p>
                            </>
                          ) : (
                            <span className="text-gray-500 dark:text-gray-400">{t("billing.globalZone")}</span>
                          )}
                        </TableCell>
                        <TableCell className="align-top px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          <p className="font-medium">{translateTariffBillingMode(plan.billingMode, t)}</p>
                          {plan.billingMode === TariffBillingMode.TIME_OF_USE ? (
                            <>
                              <p className="break-words">{t("billing.hpPriceLine", { value: plan.hpUnitPrice?.toString() || "0", currency: plan.currency })}</p>
                              <p className="break-words">{t("billing.hcPriceLine", { value: plan.hcUnitPrice?.toString() || "0", currency: plan.currency })}</p>
                            </>
                          ) : (
                            <p className="break-words">{t("billing.unitPriceLine", { value: plan.singleUnitPrice?.toString() || "0", currency: plan.currency })}</p>
                          )}
                          <p className="break-words">{t("billing.fixedChargeLine", { value: plan.fixedCharge.toString(), currency: plan.currency })}</p>
                          <p className="break-words">{t("billing.baseTaxLine", { value: plan.taxPercent.toString() })}</p>
                        </TableCell>
                        <TableCell className="align-top px-4 py-3 text-xs text-gray-700 dark:text-gray-300">
                          {plan.taxes.length === 0 ? (
                            <span className="text-gray-500 dark:text-gray-400">{t("billing.noAdditionalTaxes")}</span>
                          ) : (
                            plan.taxes.map((taxLink) => (
                              <p key={taxLink.id} className="break-words">
                                {t("billing.taxRuleLine", {
                                  name: taxLink.taxRule.name,
                                  type: taxLink.taxRule.type,
                                  scope: taxLink.taxRule.applicationScope,
                                  value: taxLink.taxRule.value.toString(),
                                })}
                              </p>
                            ))
                          )}
                        </TableCell>
                        <TableCell className="align-top px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          <p>{t("billing.campaignsUsage", { count: plan._count.campaigns })}</p>
                          <p>{t("billing.invoicesUsage", { count: plan._count.invoices })}</p>
                          <p className="break-words text-xs text-gray-500 dark:text-gray-400">
                            {plan.effectiveFrom
                              ? t("billing.fromDate", { date: plan.effectiveFrom.toISOString().slice(0, 10) })
                              : t("billing.immediate")}
                            {plan.effectiveTo
                              ? ` · ${t("billing.untilDate", { date: plan.effectiveTo.toISOString().slice(0, 10) })}`
                              : ""}
                          </p>
                        </TableCell>
                        <TableCell className="align-top px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          {plan.isDefault ? `${t("billing.defaultBadge")} • ` : ""}
                          {plan.isActive ? t("billing.active") : t("billing.inactive")}
                        </TableCell>
                        <TableCell className="align-top px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          <TariffPlanStatusSwitch
                            planId={plan.id}
                            planCode={plan.code}
                            initialChecked={plan.isActive}
                          />
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
