import { Metadata } from "next";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import ComponentCard from "@/components/common/ComponentCard";
import BillingCreatePanel from "@/components/billing/BillingCreatePanel";
import BillingSchemaNotice from "@/components/billing/BillingSchemaNotice";
import Label from "@/components/form/Label";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
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
  const resolved = await searchParams;
  const error = firstValue(resolved.error);
  const success = firstValue(resolved.success);

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
      where: { deletedAt: null },
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
        <PageBreadcrumb pageTitle="Billing cities" />
        <BillingSchemaNotice {...errorState} />
      </div>
    );
  }

  return (
    <div>
      <PageBreadcrumb pageTitle="Billing cities" />

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
          title="City creation form"
          openDescription="The form is open. You can register a new billing city, then continue structuring zones just below."
          closedDescription="The form is hidden by default to keep the cities table easier to scan. Open it only when you need to add a new city."
          openLabel="New city"
          closeLabel="Hide form"
        >
          <ComponentCard
            title="Create city"
            desc="Register the city reference used by billing zones."
          >
            <form action={createCityAction} className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                <Field label="Code">
                  <Input name="code" placeholder="CG-CITY-BZV" required />
                </Field>
                <Field label="City name">
                  <Input name="name" placeholder="Brazzaville" required />
                </Field>
                <Field label="Region">
                  <Input name="region" placeholder="Brazzaville" />
                </Field>
              </div>
              <button
                type="submit"
                className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600"
              >
                Create city
              </button>
            </form>
          </ComponentCard>
        </BillingCreatePanel>

        <ComponentCard title="Cities" desc="Reference cities that group billing zones.">
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
            <Table className="table-fixed">
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>
                  <TableCell isHeader className="w-[34%] px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                    City
                  </TableCell>
                  <TableCell isHeader className="w-[28%] px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                    Region
                  </TableCell>
                  <TableCell isHeader className="w-[18%] px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                    Zones
                  </TableCell>
                  <TableCell isHeader className="w-[20%] px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                    Status
                  </TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {cities.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                      No cities yet.
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
                        <span className="break-words">{city.region || "No region"}</span>
                      </TableCell>
                      <TableCell className="align-top px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        {city._count.zones}
                      </TableCell>
                      <TableCell className="align-top px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        {city.isActive ? "Active" : "Inactive"}
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
