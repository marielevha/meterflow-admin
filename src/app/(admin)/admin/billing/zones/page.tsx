import { Metadata } from "next";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import ComponentCard from "@/components/common/ComponentCard";
import BillingCreatePanel from "@/components/billing/BillingCreatePanel";
import BillingSchemaNotice from "@/components/billing/BillingSchemaNotice";
import Label from "@/components/form/Label";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
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
        <PageBreadcrumb pageTitle="Billing zones" />
        <BillingSchemaNotice {...errorState} />
      </div>
    );
  }

  return (
    <div>
      <PageBreadcrumb pageTitle="Billing zones" />

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
          title="Zone creation form"
          openDescription="The form is open. You can register a new service zone, then continue reviewing coverage just below."
          closedDescription="The form is hidden by default to keep the zones table easier to scan. Open it only when you need to add a new zone."
          openLabel="New zone"
          closeLabel="Hide form"
        >
          <ComponentCard
            title="Create zone"
            desc="Register operational service zones used by meters, tariffs and campaigns."
          >
            <form action={createZoneAction} className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                <Field label="Code">
                  <Input name="code" placeholder="CG-BZV-BCG" required />
                </Field>
                <Field label="Zone name">
                  <Input name="name" placeholder="Bacongo" required />
                </Field>
                <Field label="City">
                  <select
                    name="cityId"
                    className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                    required
                  >
                    <option value="">Choose city</option>
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
                Create zone
              </button>
            </form>
          </ComponentCard>
        </BillingCreatePanel>

        <ComponentCard
          title="Zones"
          desc="Coverage summary for billing operations."
        >
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
              <Table className="table-fixed">
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>
                    <TableCell isHeader className="w-[28%] px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Zone</TableCell>
                    <TableCell isHeader className="w-[28%] px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">City</TableCell>
                    <TableCell isHeader className="w-[11%] px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Meters</TableCell>
                    <TableCell isHeader className="w-[11%] px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Tariffs</TableCell>
                    <TableCell isHeader className="w-[12%] px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Campaigns</TableCell>
                    <TableCell isHeader className="w-[10%] px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Status</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                  {zones.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                        No zones yet.
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
                          <p className="break-words text-xs text-gray-500 dark:text-gray-400">{zone.city.region || "No region"}</p>
                        </TableCell>
                        <TableCell className="align-top px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{zone._count.meters}</TableCell>
                        <TableCell className="align-top px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{zone._count.tariffPlans}</TableCell>
                        <TableCell className="align-top px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{zone._count.campaignAssignments}</TableCell>
                        <TableCell className="align-top px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          {zone.isActive ? "Active" : "Inactive"}
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
