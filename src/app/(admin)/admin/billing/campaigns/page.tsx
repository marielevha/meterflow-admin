import { Metadata } from "next";
import { BillingCampaignStatus, Prisma } from "@prisma/client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import ComponentCard from "@/components/common/ComponentCard";
import BillingCreatePanel from "@/components/billing/BillingCreatePanel";
import Label from "@/components/form/Label";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/prisma";
import {
  createBillingCampaignAction,
  generateCampaignInvoicesAction,
  issueCampaignInvoicesAction,
} from "@/app/(admin)/admin/billing/actions";
import BillingSchemaNotice from "@/components/billing/BillingSchemaNotice";
import { getBillingPageErrorState } from "@/lib/backoffice/billingPageErrors";

export const metadata: Metadata = {
  title: "Billing Campaigns",
  description: "Manage billing campaigns",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type CampaignRow = Prisma.BillingCampaignGetPayload<{
  select: {
    id: true;
    code: true;
    name: true;
    periodStart: true;
    periodEnd: true;
    cityNameSnapshot: true;
    zoneNameSnapshot: true;
    status: true;
    zones: {
      where: { deletedAt: null; zone: { deletedAt: null } };
      select: {
        id: true;
        cityNameSnapshot: true;
        zoneNameSnapshot: true;
        zone: {
          select: {
            id: true;
            code: true;
            name: true;
            city: { select: { id: true; code: true; name: true; region: true } };
          };
        };
      };
    };
    tariffPlan: { select: { id: true; code: true; name: true; billingMode: true } };
    _count: { select: { invoices: true } };
  };
}>;
type TariffPlanOption = Prisma.TariffPlanGetPayload<{
  select: {
    id: true;
    code: true;
    name: true;
    zoneId: true;
    billingMode: true;
    serviceZone: {
      select: {
        id: true;
        code: true;
        name: true;
        city: { select: { id: true; code: true; name: true; region: true } };
      };
    };
  };
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
  let zones: Array<{
    id: string;
    code: string;
    name: string;
    city: { id: string; code: string; name: string; region: string | null };
  }> = [];
  try {
    [campaigns, tariffPlans, zones] = await prisma.$transaction([
      prisma.billingCampaign.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          code: true,
          name: true,
          periodStart: true,
          periodEnd: true,
          cityNameSnapshot: true,
          zoneNameSnapshot: true,
          status: true,
          zones: {
            where: { deletedAt: null, zone: { deletedAt: null } },
            select: {
              id: true,
              cityNameSnapshot: true,
              zoneNameSnapshot: true,
              zone: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  city: { select: { id: true, code: true, name: true, region: true } },
                },
              },
            },
          },
          tariffPlan: { select: { id: true, code: true, name: true, billingMode: true } },
          _count: { select: { invoices: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.tariffPlan.findMany({
        where: { deletedAt: null, isActive: true },
        select: {
          id: true,
          code: true,
          name: true,
          zoneId: true,
          billingMode: true,
          serviceZone: {
            select: {
              id: true,
              code: true,
              name: true,
              city: { select: { id: true, code: true, name: true, region: true } },
            },
          },
        },
        orderBy: [{ code: "asc" }],
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
    const errorState = getBillingPageErrorState(error, "billing.campaigns");
    return (
      <div>
        <PageBreadcrumb pageTitle="Billing campaigns" />
        <BillingSchemaNotice {...errorState} />
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

      <div className="space-y-6">
        <BillingCreatePanel
          defaultOpen={Boolean(error)}
          title="Campaign creation form"
          openDescription="The form is open. You can create a new billing cycle, then continue monitoring campaigns in the table below."
          closedDescription="The form is hidden by default to keep the campaigns table easier to scan. Open it only when you need to launch a new billing cycle."
          openLabel="New campaign"
          closeLabel="Hide form"
        >
          <ComponentCard
            title="Create campaign"
            desc="Open a billing cycle for one or many zones and link it to a compatible tariff."
          >
            <form action={createBillingCampaignAction} className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Code">
                  <Input name="code" placeholder="CG-BILL-2026-03-BCG" required />
                </Field>
                <Field label="Campaign name">
                  <Input name="name" placeholder="Mars 2026 Bacongo" required />
                </Field>
                <Field label="Zones">
                  <select
                    name="zoneIds"
                    multiple
                    size={Math.min(6, Math.max(3, zones.length))}
                    className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                  >
                    {zones.map((zone) => (
                      <option key={zone.id} value={zone.id}>
                        {zone.city.name} - {zone.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    Leave empty for a global campaign. Hold Ctrl or Cmd to select multiple zones.
                  </p>
                </Field>
                <Field label="Tariff plan">
                  <select
                    name="tariffPlanId"
                    className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                    required
                  >
                    <option value="">Choose tariff plan</option>
                    {tariffPlans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.code} - {plan.name}
                        {plan.serviceZone ? ` (${plan.serviceZone.city.name} / ${plan.serviceZone.name})` : " (Global)"}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Period start">
                  <Input name="periodStart" type="datetime-local" required />
                </Field>
                <Field label="Period end">
                  <Input name="periodEnd" type="datetime-local" required />
                </Field>
                <Field label="Submission start">
                  <Input name="submissionStartAt" type="datetime-local" />
                </Field>
                <Field label="Submission end">
                  <Input name="submissionEndAt" type="datetime-local" />
                </Field>
                <Field label="Cutoff date">
                  <Input name="cutoffAt" type="datetime-local" />
                </Field>
                <Field label="Frequency">
                  <Input name="frequency" placeholder="MONTHLY" defaultValue="MONTHLY" />
                </Field>
              </div>
              <Field label="Notes">
                <textarea
                  name="notes"
                  rows={2}
                  placeholder="Optional campaign notes"
                  className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                />
              </Field>
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-600 dark:border-gray-800 dark:bg-white/[0.02] dark:text-gray-400">
                Global tariffs can be used across multiple zones. Zone-specific tariffs stay restricted to their own zone.
              </div>
              <button
                type="submit"
                className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600"
              >
                Create campaign
              </button>
            </form>
          </ComponentCard>
        </BillingCreatePanel>

        <ComponentCard
          title="Campaigns"
          desc="Generate and issue invoices by zone and billing cycle."
        >
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
              <Table className="table-fixed">
                <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                  <TableRow>
                    <TableCell isHeader className="w-[20%] px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Campaign</TableCell>
                    <TableCell isHeader className="w-[14%] px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Period</TableCell>
                    <TableCell isHeader className="w-[24%] px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Zones</TableCell>
                    <TableCell isHeader className="w-[16%] px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Tariff</TableCell>
                    <TableCell isHeader className="w-[8%] px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Invoices</TableCell>
                    <TableCell isHeader className="w-[8%] px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Status</TableCell>
                    <TableCell isHeader className="w-[10%] px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Actions</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                  {campaigns.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                        No campaigns yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    campaigns.map((campaign) => (
                      <TableRow key={campaign.id}>
                        <TableCell className="align-top px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          <p className="break-words font-medium">{campaign.code}</p>
                          <p className="break-words text-xs text-gray-500 dark:text-gray-400">{campaign.name}</p>
                        </TableCell>
                        <TableCell className="align-top px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          <p className="break-words">{campaign.periodStart.toISOString().slice(0, 10)}</p>
                          <p className="break-words text-xs text-gray-500 dark:text-gray-400">
                            to {campaign.periodEnd.toISOString().slice(0, 10)}
                          </p>
                        </TableCell>
                        <TableCell className="align-top px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          {campaign.zones.length > 0 ? (
                            <div className="space-y-1">
                              {campaign.zones.map((zoneLink) => (
                                <div key={zoneLink.id}>
                                  <p className="break-words font-medium">{zoneLink.cityNameSnapshot || zoneLink.zone.city.name}</p>
                                  <p className="break-words text-xs text-gray-500 dark:text-gray-400">
                                    {zoneLink.zoneNameSnapshot || zoneLink.zone.name} ({zoneLink.zone.code})
                                  </p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="break-words">
                              {campaign.cityNameSnapshot || campaign.zoneNameSnapshot
                                ? `${campaign.cityNameSnapshot || "All cities"} / ${campaign.zoneNameSnapshot || "All zones"}`
                                : "All zones"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="align-top px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          {campaign.tariffPlan ? (
                            <>
                              <p className="break-words font-medium">{campaign.tariffPlan.code}</p>
                              <p className="break-words text-xs text-gray-500 dark:text-gray-400">
                                {campaign.tariffPlan.billingMode === "TIME_OF_USE" ? "HP / HC" : "Single rate"}
                              </p>
                            </>
                          ) : (
                            "N/A"
                          )}
                        </TableCell>
                        <TableCell className="align-top px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{campaign._count.invoices}</TableCell>
                        <TableCell className="align-top px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          <span className="break-words">{campaign.status}</span>
                        </TableCell>
                        <TableCell className="align-top px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
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
