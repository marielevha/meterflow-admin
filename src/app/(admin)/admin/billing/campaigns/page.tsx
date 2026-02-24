import { Metadata } from "next";
import { BillingCampaignStatus, Prisma } from "@prisma/client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import ComponentCard from "@/components/common/ComponentCard";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/prisma";
import {
  createBillingCampaignAction,
  generateCampaignInvoicesAction,
  issueCampaignInvoicesAction,
} from "@/app/(admin)/admin/billing/actions";
import BillingSchemaNotice from "@/components/billing/BillingSchemaNotice";

export const metadata: Metadata = {
  title: "Billing Campaigns | MeterFlow Dashboard",
  description: "Manage billing campaigns",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type CampaignRow = Prisma.BillingCampaignGetPayload<{
  include: {
    tariffPlan: { select: { id: true; code: true; name: true } };
    _count: { select: { invoices: true } };
  };
}>;
type TariffPlanOption = Prisma.TariffPlanGetPayload<{
  select: { id: true; code: true; name: true };
}>;

function firstValue(input: string | string[] | undefined) {
  if (Array.isArray(input)) return input[0] ?? "";
  return input ?? "";
}

export default async function BillingCampaignsPage({ searchParams }: { searchParams: SearchParams }) {
  const resolved = await searchParams;
  const error = firstValue(resolved.error);
  const success = firstValue(resolved.success);
  const terminalStatuses = new Set<BillingCampaignStatus>([
    BillingCampaignStatus.ISSUED,
    BillingCampaignStatus.CLOSED,
  ]);
  let campaigns: CampaignRow[] = [];
  let tariffPlans: TariffPlanOption[] = [];
  try {
    [campaigns, tariffPlans] = await prisma.$transaction([
      prisma.billingCampaign.findMany({
        where: { deletedAt: null },
        include: {
          tariffPlan: { select: { id: true, code: true, name: true } },
          _count: { select: { invoices: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.tariffPlan.findMany({
        where: { deletedAt: null, isActive: true },
        select: { id: true, code: true, name: true },
        orderBy: [{ isDefault: "desc" }, { code: "asc" }],
      }),
    ]);
  } catch {
    return (
      <div>
        <PageBreadcrumb pageTitle="Billing campaigns" />
        <BillingSchemaNotice />
      </div>
    );
  }

  return (
    <div>
      <PageBreadcrumb pageTitle="Billing campaigns" />

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
          title="Create campaign"
          desc="Campaign planning for invoice generation."
          className="xl:col-span-4"
        >
          <form action={createBillingCampaignAction} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Input name="code" placeholder="Code (e.g. CAMP-2026-03-BZV)" required />
              <Input name="name" placeholder="Campaign name" required />
              <Input name="periodStart" type="datetime-local" required />
              <Input name="periodEnd" type="datetime-local" required />
              <Input name="submissionStartAt" type="datetime-local" />
              <Input name="submissionEndAt" type="datetime-local" />
              <Input name="cutoffAt" type="datetime-local" />
              <Input name="frequency" placeholder="MONTHLY or BIMONTHLY" defaultValue="MONTHLY" />
              <select
                name="tariffPlanId"
                className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                required
              >
                <option value="">Choose tariff plan</option>
                {tariffPlans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.code} - {plan.name}
                  </option>
                ))}
              </select>
              <Input name="city" placeholder="City (optional)" />
              <Input name="zone" placeholder="Zone (optional)" />
            </div>
            <textarea
              name="notes"
              rows={2}
              placeholder="Notes"
              className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
            />
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600"
            >
              Create campaign
            </button>
          </form>
        </ComponentCard>

        <ComponentCard
          title="Campaigns"
          desc="Generate and issue invoices by campaign."
          className="xl:col-span-8"
        >
          <div className="max-w-full overflow-x-auto">
            <div className="min-w-[1200px] overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
              <Table>
                <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                  <TableRow>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Campaign</TableCell>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Period</TableCell>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Scope</TableCell>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Tariff</TableCell>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Invoices</TableCell>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Status</TableCell>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Actions</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                  {campaigns.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">No campaigns yet.</TableCell>
                    </TableRow>
                  ) : (
                    campaigns.map((campaign) => (
                      <TableRow key={campaign.id}>
                        <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          <p className="font-medium">{campaign.code}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{campaign.name}</p>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          {campaign.periodStart.toISOString().slice(0, 10)} → {campaign.periodEnd.toISOString().slice(0, 10)}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          {campaign.city || "All cities"} / {campaign.zone || "All zones"}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          {campaign.tariffPlan?.code || "N/A"}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{campaign._count.invoices}</TableCell>
                        <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{campaign.status}</TableCell>
                        <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          <div className="flex flex-wrap gap-2">
                            <form action={generateCampaignInvoicesAction}>
                              <input type="hidden" name="campaignId" value={campaign.id} />
                              <button
                                type="submit"
                                disabled={terminalStatuses.has(campaign.status)}
                                className="inline-flex h-8 items-center justify-center rounded-lg border border-gray-300 px-3 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]"
                              >
                                Generate
                              </button>
                            </form>
                            <form action={issueCampaignInvoicesAction}>
                              <input type="hidden" name="campaignId" value={campaign.id} />
                              <button
                                type="submit"
                                disabled={campaign._count.invoices === 0 || terminalStatuses.has(campaign.status)}
                                className="inline-flex h-8 items-center justify-center rounded-lg bg-brand-500 px-3 text-xs font-medium text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Issue
                              </button>
                            </form>
                          </div>
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
