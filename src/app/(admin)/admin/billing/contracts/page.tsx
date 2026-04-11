import { Metadata } from "next";
import { MeterType, Prisma, ServicePhaseType, ServicePowerUnit, ServiceUsageCategory, TariffBillingMode } from "@prisma/client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import ComponentCard from "@/components/common/ComponentCard";
import BillingCreatePanel from "@/components/billing/BillingCreatePanel";
import BillingSchemaNotice from "@/components/billing/BillingSchemaNotice";
import Label from "@/components/form/Label";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import {
  translateContractPhaseType,
  translateContractPowerUnit,
  translateContractStatus,
  translateContractUsageCategory,
  translateTariffBillingMode,
} from "@/lib/admin-i18n/labels";
import { getAdminTranslator } from "@/lib/admin-i18n/server";
import {
  ADMIN_PERMISSION_GROUPS,
  hasAnyPermissionCode,
  requireAdminPermissions,
} from "@/lib/auth/adminPermissions";
import { getCurrentStaffPermissionCodes } from "@/lib/auth/staffServerSession";
import { getBillingPageErrorState } from "@/lib/backoffice/billingPageErrors";
import { deriveServiceContractStatus, listServiceContracts } from "@/lib/backoffice/serviceContracts";
import { prisma } from "@/lib/prisma";
import {
  closeServiceContractAction,
  createServiceContractAction,
} from "@/app/(admin)/admin/billing/actions";

export const metadata: Metadata = {
  title: "Billing Contracts",
  description: "Manage subscribed power service contracts",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type MeterOption = Prisma.MeterGetPayload<{
  select: {
    id: true;
    serialNumber: true;
    meterReference: true;
    type: true;
    city: true;
    zone: true;
    assignments: {
      where: { endedAt: null; deletedAt: null };
      orderBy: [{ assignedAt: "desc" }, { createdAt: "desc" }];
      take: 1;
      select: {
        customer: {
          select: {
            firstName: true;
            lastName: true;
            username: true;
            phone: true;
          };
        };
      };
    };
  };
}>;

function firstValue(input: string | string[] | undefined) {
  if (Array.isArray(input)) return input[0] ?? "";
  return input ?? "";
}

function displayPerson(person?: {
  firstName: string | null;
  lastName: string | null;
  username?: string | null;
  phone?: string | null;
} | null) {
  if (!person) return "";
  return (
    [person.firstName, person.lastName].filter(Boolean).join(" ").trim() ||
    person.username ||
    person.phone ||
    ""
  );
}

function formatDate(value: Date | null) {
  if (!value) return "N/A";
  return value.toISOString().slice(0, 10);
}

export default async function BillingContractsPage({ searchParams }: { searchParams: SearchParams }) {
  const staff = await requireAdminPermissions(
    "/admin/billing/contracts",
    ADMIN_PERMISSION_GROUPS.billingContractsView,
  );
  const permissionCodes = await getCurrentStaffPermissionCodes(staff.id);
  const canManageContracts = hasAnyPermissionCode(
    permissionCodes,
    ADMIN_PERMISSION_GROUPS.billingContractsManage,
  );
  const { t } = await getAdminTranslator();
  const resolved = await searchParams;
  const error = firstValue(resolved.error);
  const success = firstValue(resolved.success);
  const q = firstValue(resolved.q).trim();
  const status = firstValue(resolved.status).trim();
  const page = Math.max(1, Number(firstValue(resolved.page) || 1));

  let result: Awaited<ReturnType<typeof listServiceContracts>>;
  let meters: MeterOption[] = [];

  try {
    [result, meters] = await Promise.all([
      listServiceContracts({ search: q, status, page, perPage: 20 }),
      prisma.meter.findMany({
        where: {
          deletedAt: null,
          assignments: { some: { endedAt: null, deletedAt: null } },
        },
        select: {
          id: true,
          serialNumber: true,
          meterReference: true,
          type: true,
          city: true,
          zone: true,
          assignments: {
            where: { endedAt: null, deletedAt: null },
            orderBy: [{ assignedAt: "desc" }, { createdAt: "desc" }],
            take: 1,
            select: {
              customer: {
                select: {
                  firstName: true,
                  lastName: true,
                  username: true,
                  phone: true,
                },
              },
            },
          },
        },
        orderBy: [{ serialNumber: "asc" }],
      }),
    ]);
  } catch (caught) {
    const errorState = getBillingPageErrorState(caught, "billing.contracts");
    return (
      <div>
        <PageBreadcrumb pageTitle={t("billing.contractsPageTitle")} />
        <BillingSchemaNotice {...errorState} />
      </div>
    );
  }

  const data = result.body as {
    contracts: Array<any>;
    total: number;
    page: number;
    totalPages: number;
    perPage: number;
  };

  return (
    <div>
      <PageBreadcrumb pageTitle={t("billing.contractsPageTitle")} />

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
        {canManageContracts ? (
          <BillingCreatePanel
            defaultOpen={Boolean(error)}
            title={t("billing.contractCreatePanelTitle")}
            openDescription={t("billing.contractCreateOpenDescription")}
            closedDescription={t("billing.contractCreateClosedDescription")}
            openLabel={t("billing.newContract")}
            closeLabel={t("billing.hideForm")}
          >
            <ComponentCard
              title={t("billing.createContractCardTitle")}
              desc={t("billing.createContractCardDesc")}
            >
              <form action={createServiceContractAction} className="space-y-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <Field label={t("billing.meterColumn")}>
                    <select
                      name="meterId"
                      required
                      className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                    >
                      <option value="">{t("billing.chooseMeter")}</option>
                      {meters.map((meter) => (
                        <option key={meter.id} value={meter.id}>
                          {meter.serialNumber} - {displayPerson(meter.assignments[0]?.customer)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={t("billing.contractNumberLabel")}>
                    <Input name="contractNumber" placeholder="CTR-CG-000245" />
                  </Field>
                  <Field label={t("billing.policeNumberLabel")}>
                    <Input name="policeNumber" placeholder="PLC-CG-000245" />
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
                  <Field label={t("billing.usageCategoryLabel")}>
                    <select
                      name="usageCategory"
                      defaultValue={ServiceUsageCategory.RESIDENTIAL}
                      className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                    >
                      {Object.values(ServiceUsageCategory).map((category) => (
                        <option key={category} value={category}>
                          {translateContractUsageCategory(category, t)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={t("billing.subscribedPowerValueLabel")}>
                    <Input name="subscribedPowerValue" type="number" step="0.001" placeholder="10" required />
                  </Field>
                  <Field label={t("billing.subscribedPowerUnitLabel")}>
                    <select
                      name="subscribedPowerUnit"
                      defaultValue={ServicePowerUnit.AMPERE}
                      className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                    >
                      {Object.values(ServicePowerUnit).map((unit) => (
                        <option key={unit} value={unit}>
                          {translateContractPowerUnit(unit, t)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={t("billing.phaseTypeLabel")}>
                    <select
                      name="phaseType"
                      defaultValue={ServicePhaseType.SINGLE_PHASE}
                      className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                    >
                      {Object.values(ServicePhaseType).map((phaseType) => (
                        <option key={phaseType} value={phaseType}>
                          {translateContractPhaseType(phaseType, t)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={t("billing.effectiveFrom")}>
                    <Input name="effectiveFrom" type="datetime-local" required />
                  </Field>
                  <Field label={t("billing.effectiveTo")}>
                    <Input name="effectiveTo" type="datetime-local" />
                  </Field>
                </div>

                <Field label={t("billing.notes")}>
                  <textarea
                    name="notes"
                    rows={2}
                    placeholder={t("billing.contractNotesPlaceholder")}
                    className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                  />
                </Field>

                <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-600 dark:border-gray-800 dark:bg-white/[0.02] dark:text-gray-400">
                  {t("billing.contractCreateHint")}
                </div>

                <button
                  type="submit"
                  className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600"
                >
                  {t("billing.createContract")}
                </button>
              </form>
            </ComponentCard>
          </BillingCreatePanel>
        ) : null}

        <ComponentCard
          title={t("billing.contractsCardTitle")}
          desc={t("billing.contractsCardDesc")}
        >
          <div className="mb-4 flex flex-col gap-3 md:flex-row">
            <Input
              name="q"
              defaultValue={q}
              form="contracts-filter-form"
              placeholder={t("billing.contractSearchPlaceholder")}
            />
            <select
              name="status"
              defaultValue={status}
              form="contracts-filter-form"
              className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs md:max-w-[220px] dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
            >
              <option value="">{t("billing.allStatuses")}</option>
              <option value="ACTIVE">{translateContractStatus("ACTIVE", t)}</option>
              <option value="PENDING">{translateContractStatus("PENDING", t)}</option>
              <option value="ENDED">{translateContractStatus("ENDED", t)}</option>
            </select>
            <form id="contracts-filter-form" className="md:ml-auto">
              <button
                type="submit"
                className="inline-flex h-11 items-center justify-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]"
              >
                {t("billing.filterAction")}
              </button>
            </form>
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
            <Table className="table-fixed">
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>
                  <TableCell isHeader className="w-[18%] px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">{t("billing.contractColumn")}</TableCell>
                  <TableCell isHeader className="w-[19%] px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">{t("billing.customerColumn")}</TableCell>
                  <TableCell isHeader className="w-[15%] px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">{t("billing.meterColumn")}</TableCell>
                  <TableCell isHeader className="w-[18%] px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">{t("billing.contractProfileColumn")}</TableCell>
                  <TableCell isHeader className="w-[12%] px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">{t("billing.periodColumn")}</TableCell>
                  <TableCell isHeader className="w-[10%] px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">{t("billing.statusColumn")}</TableCell>
                  <TableCell isHeader className="w-[8%] px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">{t("common.actions")}</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {data.contracts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                      {t("billing.noContractsYet")}
                    </TableCell>
                  </TableRow>
                ) : (
                  data.contracts.map((contract) => (
                    <TableRow key={contract.id}>
                      <TableCell className="align-top px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        <p className="break-words font-medium">{contract.contractNumber || t("billing.noContractNumber")}</p>
                        <p className="break-words text-xs text-gray-500 dark:text-gray-400">
                          {contract.policeNumber || t("billing.noPoliceNumber")}
                        </p>
                      </TableCell>
                      <TableCell className="align-top px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        <p className="break-words font-medium">{contract.customerLabel}</p>
                        <p className="break-words text-xs text-gray-500 dark:text-gray-400">
                          {contract.customer.phone || t("billing.notAvailableShort")}
                        </p>
                      </TableCell>
                      <TableCell className="align-top px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        <p className="break-words font-medium">{contract.meter.serialNumber}</p>
                        <p className="break-words text-xs text-gray-500 dark:text-gray-400">
                          {contract.meter.city || "-"} / {contract.meter.zone || "-"}
                        </p>
                      </TableCell>
                      <TableCell className="align-top px-4 py-3 text-xs text-gray-700 dark:text-gray-300">
                        <p>{translateContractUsageCategory(contract.usageCategory, t)}</p>
                        <p>{translateTariffBillingMode(contract.billingMode, t)}</p>
                        <p>
                          {contract.subscribedPowerValue.toString()} {translateContractPowerUnit(contract.subscribedPowerUnit, t)}
                        </p>
                        <p>{translateContractPhaseType(contract.phaseType, t)}</p>
                        <p className="text-gray-500 dark:text-gray-400">
                          {t("billing.invoicesUsage", { count: contract._count.invoices })}
                        </p>
                      </TableCell>
                      <TableCell className="align-top px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        <p>{formatDate(contract.effectiveFrom)}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(contract.effectiveTo)}</p>
                      </TableCell>
                      <TableCell className="align-top px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        {translateContractStatus(contract.derivedStatus, t)}
                      </TableCell>
                      <TableCell className="align-top px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        {canManageContracts && deriveServiceContractStatus(contract) === "ACTIVE" ? (
                          <form action={closeServiceContractAction}>
                            <input type="hidden" name="contractId" value={contract.id} />
                            <button
                              type="submit"
                              className="inline-flex h-8 items-center justify-center rounded-lg border border-gray-300 px-3 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]"
                            >
                              {t("billing.closeContract")}
                            </button>
                          </form>
                        ) : (
                          <span className="text-xs text-gray-500 dark:text-gray-400">{t("common.notAvailable")}</span>
                        )}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
