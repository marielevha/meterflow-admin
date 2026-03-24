import { Metadata } from "next";
import { Prisma, TariffBillingMode } from "@prisma/client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import ComponentCard from "@/components/common/ComponentCard";
import BillingCreatePanel from "@/components/billing/BillingCreatePanel";
import BillingSchemaNotice from "@/components/billing/BillingSchemaNotice";
import TariffPlanStatusSwitch from "@/components/billing/TariffPlanStatusSwitch";
import Label from "@/components/form/Label";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
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
        <PageBreadcrumb pageTitle="Billing tariffs" />
        <BillingSchemaNotice {...errorState} />
      </div>
    );
  }

  return (
    <div>
      <PageBreadcrumb pageTitle="Billing tariffs" />

      {error ? (
        <div className="mb-4 rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300">
          Error: {error}
        </div>
      ) : null}
      {success ? (
        <div className="mb-4 rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-300">
          Success: {success}
        </div>
      ) : null}

      <div className="space-y-6">
        <BillingCreatePanel
          defaultOpen={Boolean(error)}
          title="Tariff creation form"
          openDescription="The form is open. You can create a new tariff plan, then return to the list just below."
          closedDescription="The form is hidden by default to keep the tariff table easier to scan. Open it only when you need to add a new plan."
          openLabel="New tariff plan"
          closeLabel="Hide form"
        >
          <ComponentCard
            title="Create tariff plan"
            desc="Define zone pricing with single-rate or HP/HC billing and optional tax rules."
          >
            <form action={createTariffPlanAction} className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Code">
                  <Input name="code" placeholder="CG-BZV-BAC-TOU-2026" required />
                </Field>
                <Field label="Plan name">
                  <Input name="name" placeholder="Bacongo HP/HC 2026" required />
                </Field>
                <Field label="Zone">
                  <select
                    name="zoneId"
                    className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                  >
                    <option value="">Global / all zones</option>
                    {zones.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                        {zone.city.name} - {zone.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Billing mode">
                  <select
                    name="billingMode"
                    defaultValue={TariffBillingMode.SINGLE_RATE}
                    className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                  >
                    <option value={TariffBillingMode.SINGLE_RATE}>Single rate</option>
                    <option value={TariffBillingMode.TIME_OF_USE}>Time of use (HP / HC)</option>
                  </select>
                </Field>
                <Field label="Currency">
                  <Input name="currency" placeholder="XAF" defaultValue="XAF" />
                </Field>
                <Field label="Fixed charge">
                  <Input name="fixedCharge" type="number" step="0.01" placeholder="1500" defaultValue="0" />
                </Field>
                <Field label="Base tax %">
                  <Input name="taxPercent" type="number" step="0.01" placeholder="18" defaultValue="0" />
                </Field>
                <Field label="Late fee %">
                  <Input name="lateFeePercent" type="number" step="0.01" placeholder="5" defaultValue="0" />
                </Field>
                <Field label="Single unit price">
                  <Input name="singleUnitPrice" type="number" step="0.001" placeholder="95" />
                </Field>
                <Field label="HP unit price">
                  <Input name="hpUnitPrice" type="number" step="0.001" placeholder="110" />
                </Field>
                <Field label="HC unit price">
                  <Input name="hcUnitPrice" type="number" step="0.001" placeholder="75" />
                </Field>
                <Field label="Effective from">
                  <Input name="effectiveFrom" type="datetime-local" />
                </Field>
                <Field label="Effective to">
                  <Input name="effectiveTo" type="datetime-local" />
                </Field>
              </div>

              <Field label="Description">
                <textarea
                  name="description"
                  rows={2}
                  placeholder="Optional internal description"
                  className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                />
              </Field>

              <Field label="Additional tax rules">
                <textarea
                  name="taxes"
                  rows={4}
                  placeholder={"TVA-AUDIO-BAC,Taxe audiovisuelle,PERCENT,SUBTOTAL,2.5\\nREDEVANCE-CNT,Redevance locale,FIXED,SUBTOTAL,500"}
                  className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 font-mono text-xs text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                />
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Format par ligne: <code>CODE,Nom,Type,Scope,Valeur[,Description]</code>. Types:
                  <code> PERCENT</code> ou <code>FIXED</code>. Scopes: <code>CONSUMPTION</code>,
                  <code> FIXED_CHARGE</code> ou <code>SUBTOTAL</code>.
                </p>
              </Field>

              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-600 dark:border-gray-800 dark:bg-white/[0.02] dark:text-gray-400">
                Use <strong>single unit price</strong> for standard meters. Use <strong>HP / HC</strong> rates
                for dual-index meters billed with peak and off-peak consumption.
              </div>

              <div>
                <Label>Default plan</Label>
                <label className="mt-2 inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input type="checkbox" name="isDefault" className="h-4 w-4" /> Set as default fallback
                </label>
              </div>

              <button
                type="submit"
                className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600"
              >
                Create tariff
              </button>
            </form>
          </ComponentCard>
        </BillingCreatePanel>

        <ComponentCard
          title="Tariff plans"
          desc="Zone assignment, rate structure and tax configuration."
        >
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
              <Table className="table-fixed">
                <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                  <TableRow>
                    <TableCell isHeader className="w-[18%] px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Plan</TableCell>
                    <TableCell isHeader className="w-[16%] px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Zone</TableCell>
                    <TableCell isHeader className="w-[18%] px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Pricing</TableCell>
                    <TableCell isHeader className="w-[22%] px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Taxes</TableCell>
                    <TableCell isHeader className="w-[14%] px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Usage</TableCell>
                    <TableCell isHeader className="w-[7%] px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Status</TableCell>
                    <TableCell isHeader className="w-[5%] px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Actions</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                  {plans.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                        No plans yet.
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
                            <span className="text-gray-500 dark:text-gray-400">Global</span>
                          )}
                        </TableCell>
                        <TableCell className="align-top px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          <p className="font-medium">
                            {plan.billingMode === TariffBillingMode.TIME_OF_USE ? "Time of use" : "Single rate"}
                          </p>
                          {plan.billingMode === TariffBillingMode.TIME_OF_USE ? (
                            <>
                              <p className="break-words">HP: {plan.hpUnitPrice?.toString() || "0"} {plan.currency}/kWh</p>
                              <p className="break-words">HC: {plan.hcUnitPrice?.toString() || "0"} {plan.currency}/kWh</p>
                            </>
                          ) : (
                            <p className="break-words">Unit: {plan.singleUnitPrice?.toString() || "0"} {plan.currency}/kWh</p>
                          )}
                          <p className="break-words">Fixed: {plan.fixedCharge.toString()} {plan.currency}</p>
                          <p className="break-words">Base tax: {plan.taxPercent.toString()}%</p>
                        </TableCell>
                        <TableCell className="align-top px-4 py-3 text-xs text-gray-700 dark:text-gray-300">
                          {plan.taxes.length === 0 ? (
                            <span className="text-gray-500 dark:text-gray-400">No additional taxes</span>
                          ) : (
                            plan.taxes.map((taxLink) => (
                              <p key={taxLink.id} className="break-words">
                                {taxLink.taxRule.name} [{taxLink.taxRule.type} / {taxLink.taxRule.applicationScope}] ={" "}
                                {taxLink.taxRule.value.toString()}
                              </p>
                            ))
                          )}
                        </TableCell>
                        <TableCell className="align-top px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          <p>{plan._count.campaigns} campaigns</p>
                          <p>{plan._count.invoices} invoices</p>
                          <p className="break-words text-xs text-gray-500 dark:text-gray-400">
                            {plan.effectiveFrom ? `From ${plan.effectiveFrom.toISOString().slice(0, 10)}` : "Immediate"}
                            {plan.effectiveTo ? ` · Until ${plan.effectiveTo.toISOString().slice(0, 10)}` : ""}
                          </p>
                        </TableCell>
                        <TableCell className="align-top px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          {plan.isDefault ? "Default • " : ""}
                          {plan.isActive ? "Active" : "Inactive"}
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
