import { Metadata } from "next";
import { Prisma } from "@prisma/client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import ComponentCard from "@/components/common/ComponentCard";
import BillingSchemaNotice from "@/components/billing/BillingSchemaNotice";
import Label from "@/components/form/Label";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { getBillingPageErrorState } from "@/lib/backoffice/billingPageErrors";
import { prisma } from "@/lib/prisma";
import { createTariffPlanAction, toggleTariffPlanAction } from "@/app/(admin)/admin/billing/actions";

export const metadata: Metadata = {
  title: "Billing Tariffs",
  description: "Manage tariff plans",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type TariffPlanRow = Prisma.TariffPlanGetPayload<{
  include: {
    tiers: true;
    _count: { select: { invoices: true } };
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
  try {
    plans = await prisma.tariffPlan.findMany({
      where: { deletedAt: null },
      include: {
        tiers: { where: { deletedAt: null }, orderBy: { minConsumption: "asc" } },
        _count: { select: { invoices: true } },
      },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });
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

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <ComponentCard
          title="Create tariff plan"
          desc="Define fixed charge, taxes and tier pricing."
          className="xl:col-span-4"
        >
          <form action={createTariffPlanAction} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Code">
                <Input name="code" placeholder="BT_STD" required />
              </Field>
              <Field label="Plan name">
                <Input name="name" placeholder="Residential standard" required />
              </Field>
              <Field label="Currency">
                <Input name="currency" placeholder="XAF" defaultValue="XAF" />
              </Field>
              <Field label="Fixed charge">
                <Input name="fixedCharge" type="number" step="0.01" placeholder="0" defaultValue="0" />
              </Field>
              <Field label="Tax %">
                <Input name="taxPercent" type="number" step="0.01" placeholder="0" defaultValue="0" />
              </Field>
              <Field label="Late fee %">
                <Input name="lateFeePercent" type="number" step="0.01" placeholder="0" defaultValue="0" />
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
            <Field label="Tier pricing rules">
              <textarea
                name="tiers"
                rows={4}
                placeholder={"min,max,unitPrice\\n0,50,86\\n50,150,102\\n150,,130"}
                className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                required
              />
            </Field>
            <div>
              <Label>Default plan</Label>
              <label className="mt-2 inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input type="checkbox" name="isDefault" className="h-4 w-4" /> Set as default
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

        <ComponentCard
          title="Tariff plans"
          desc="All plans and operational status."
          className="xl:col-span-8"
        >
          <div className="max-w-full overflow-x-auto">
            <div className="min-w-[1050px] overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
              <Table>
                <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                  <TableRow>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Code</TableCell>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Pricing</TableCell>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Tiers</TableCell>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Invoices</TableCell>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Status</TableCell>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Actions</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                  {plans.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">No plans yet.</TableCell>
                    </TableRow>
                  ) : (
                    plans.map((plan) => (
                      <TableRow key={plan.id}>
                        <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          <p className="font-medium">{plan.code}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{plan.name}</p>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          <p>Fixed: {plan.fixedCharge.toString()} {plan.currency}</p>
                          <p>Tax: {plan.taxPercent.toString()}%</p>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-xs text-gray-700 dark:text-gray-300">
                          {plan.tiers.map((tier) => (
                            <p key={tier.id}>
                              {tier.minConsumption.toString()} - {tier.maxConsumption?.toString() || "INF"} = {tier.unitPrice.toString()}
                            </p>
                          ))}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{plan._count.invoices}</TableCell>
                        <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          {plan.isDefault ? "Default • " : ""}
                          {plan.isActive ? "Active" : "Inactive"}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          <form action={toggleTariffPlanAction}>
                            <input type="hidden" name="planId" value={plan.id} />
                            <input type="hidden" name="nextActive" value={plan.isActive ? "false" : "true"} />
                            <button
                              type="submit"
                              className="inline-flex h-9 items-center justify-center rounded-lg border border-gray-300 px-3 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]"
                            >
                              {plan.isActive ? "Disable" : "Enable"}
                            </button>
                          </form>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
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
