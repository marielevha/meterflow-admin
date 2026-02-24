import { Metadata } from "next";
import Link from "next/link";
import { Prisma } from "@prisma/client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import ComponentCard from "@/components/common/ComponentCard";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import ConsumptionFilters from "@/components/consumption/ConsumptionFilters";
import ConsumptionPerPage from "@/components/consumption/ConsumptionPerPage";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Consumption | MeterFlow Dashboard",
  description: "Consumption analytics overview",
};

const PAGE_SIZE_OPTIONS = [10, 20, 50];

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValue(input: string | string[] | undefined): string {
  if (Array.isArray(input)) return input[0] ?? "";
  return input ?? "";
}

function toNumber(input: unknown) {
  if (input === null || input === undefined) return 0;
  const value = Number(input.toString());
  return Number.isFinite(value) ? value : 0;
}

export default async function ConsumptionPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const resolvedSearchParams = await searchParams;
  const q = firstValue(resolvedSearchParams.q).trim();
  const city = firstValue(resolvedSearchParams.city).trim();
  const zone = firstValue(resolvedSearchParams.zone).trim();
  const pageSizeRaw = Number(firstValue(resolvedSearchParams.pageSize) || "10");
  const pageSize = PAGE_SIZE_OPTIONS.includes(pageSizeRaw) ? pageSizeRaw : 10;
  const requestedPage = Math.max(1, Number(firstValue(resolvedSearchParams.page) || "1"));

  const meterWhere: Prisma.MeterWhereInput = {
    deletedAt: null,
    ...(city ? { city } : {}),
    ...(zone ? { zone } : {}),
    ...(q
      ? {
          OR: [
            { serialNumber: { contains: q, mode: "insensitive" } },
            { meterReference: { contains: q, mode: "insensitive" } },
            { city: { contains: q, mode: "insensitive" } },
            { zone: { contains: q, mode: "insensitive" } },
            { customer: { firstName: { contains: q, mode: "insensitive" } } },
            { customer: { lastName: { contains: q, mode: "insensitive" } } },
            { customer: { phone: { contains: q } } },
          ],
        }
      : {}),
  };

  const [allMeterLocations, totalFiltered] = await prisma.$transaction([
    prisma.meter.findMany({
      where: { deletedAt: null },
      select: { city: true, zone: true },
    }),
    prisma.meter.count({ where: meterWhere }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const skip = (page - 1) * pageSize;

  const meters = await prisma.meter.findMany({
    where: meterWhere,
    include: {
      customer: { select: { firstName: true, lastName: true, phone: true } },
      states: {
        where: { deletedAt: null },
        orderBy: { effectiveAt: "desc" },
        take: 2,
      },
      readings: {
        where: { deletedAt: null },
        orderBy: { readingAt: "desc" },
        take: 6,
      },
    },
    orderBy: { createdAt: "desc" },
    skip,
    take: pageSize,
  });

  const rows = meters.map((meter) => {
    const [latest, previous] = meter.states;
    const primaryCurrent = toNumber(latest?.currentPrimary);
    const primaryPrevious = toNumber(previous?.currentPrimary ?? latest?.previousPrimary);
    const secondaryCurrent = toNumber(latest?.currentSecondary);
    const secondaryPrevious = toNumber(previous?.currentSecondary ?? latest?.previousSecondary);

    const deltaPrimary = Math.max(0, primaryCurrent - primaryPrevious);
    const deltaSecondary = Math.max(0, secondaryCurrent - secondaryPrevious);
    const totalDelta = deltaPrimary + deltaSecondary;

    const readingsAvg =
      meter.readings.length > 0
        ? meter.readings.reduce((sum, r) => sum + toNumber(r.primaryIndex), 0) / meter.readings.length
        : 0;

    const customer =
      [meter.customer.firstName, meter.customer.lastName].filter(Boolean).join(" ").trim() ||
      meter.customer.phone;

    return {
      id: meter.id,
      meter: meter.serialNumber,
      reference: meter.meterReference || "N/A",
      customer,
      city: meter.city || "-",
      zone: meter.zone || "-",
      deltaPrimary,
      deltaSecondary,
      totalDelta,
      readingsAvg,
    };
  });

  const totalConsumption = rows.reduce((sum, row) => sum + row.totalDelta, 0);
  const averagePerMeter = rows.length ? totalConsumption / rows.length : 0;
  const topConsumers = [...rows].sort((a, b) => b.totalDelta - a.totalDelta).slice(0, 5);
  const cityOptions = Array.from(
    new Set(allMeterLocations.map((item) => item.city).filter(Boolean) as string[]),
  ).sort((a, b) => a.localeCompare(b));
  const zoneOptions = Array.from(
    new Set(allMeterLocations.map((item) => item.zone).filter(Boolean) as string[]),
  ).sort((a, b) => a.localeCompare(b));

  const buildHref = (overrides: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    const nextQ = overrides.q ?? q;
    const nextCity = overrides.city ?? city;
    const nextZone = overrides.zone ?? zone;
    const nextPageSize = overrides.pageSize ?? pageSize;
    const nextPage = overrides.page ?? page;

    if (nextQ) params.set("q", String(nextQ));
    if (nextCity) params.set("city", String(nextCity));
    if (nextZone) params.set("zone", String(nextZone));
    if (nextPageSize) params.set("pageSize", String(nextPageSize));
    if (nextPage && Number(nextPage) > 1) params.set("page", String(nextPage));

    const query = params.toString();
    return query ? `/admin/consumption?${query}` : "/admin/consumption";
  };

  const startPage = Math.max(1, page - 2);
  const endPage = Math.min(totalPages, startPage + 4);
  const visiblePages = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);

  return (
    <div>
      <PageBreadcrumb pageTitle="Consumption" />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Total latest consumption" value={totalConsumption.toFixed(2)} />
        <StatCard label="Average per meter" value={averagePerMeter.toFixed(2)} />
        <StatCard label="Meters analyzed" value={String(rows.length)} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <ComponentCard title="Top consumers" desc="Top 5 par consommation la plus recente." className="xl:col-span-1">
          <div className="space-y-3">
            {topConsumers.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No data</p>
            ) : (
              topConsumers.map((item, index) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-white/[0.02]"
                >
                  <p className="text-xs text-gray-500 dark:text-gray-400">#{index + 1}</p>
                  <p className="mt-1 text-sm font-medium text-gray-800 dark:text-white/90">{item.meter}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{item.customer}</p>
                  <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
                    {item.totalDelta.toFixed(2)}
                  </p>
                </div>
              ))
            )}
          </div>
        </ComponentCard>

        <ComponentCard title="Consumption by meter" desc="Delta entre les 2 derniers etats du compteur." className="xl:col-span-2">
          <ConsumptionFilters
            initialQ={q}
            initialCity={city}
            initialZone={zone}
            cityOptions={cityOptions}
            zoneOptions={zoneOptions}
          />

          <div className="max-w-full overflow-x-auto">
            <div className="min-w-[1200px] overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
              <Table>
                <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                  <TableRow>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Meter</TableCell>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Customer</TableCell>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Location</TableCell>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Delta primary</TableCell>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Delta secondary</TableCell>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Total delta</TableCell>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Avg latest readings</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                        No consumption data found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          <p className="font-medium">{row.meter}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{row.reference}</p>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.customer}</TableCell>
                        <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          {row.city} / {row.zone}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.deltaPrimary.toFixed(2)}</TableCell>
                        <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.deltaSecondary.toFixed(2)}</TableCell>
                        <TableCell className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white">{row.totalDelta.toFixed(2)}</TableCell>
                        <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.readingsAvg.toFixed(2)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Showing {rows.length === 0 ? 0 : skip + 1} - {Math.min(skip + rows.length, totalFiltered)} of{" "}
                {totalFiltered} meters
              </p>
              <ConsumptionPerPage value={pageSize} options={PAGE_SIZE_OPTIONS} />
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={buildHref({ page: page - 1 })}
                aria-disabled={page <= 1}
                className={`inline-flex h-10 items-center justify-center rounded-lg border px-3 text-sm ${
                  page <= 1
                    ? "pointer-events-none border-gray-200 text-gray-400 dark:border-gray-800 dark:text-gray-600"
                    : "border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]"
                }`}
              >
                Previous
              </Link>

              {visiblePages.map((pageNumber) => (
                <Link
                  key={pageNumber}
                  href={buildHref({ page: pageNumber })}
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-lg text-sm font-medium ${
                    pageNumber === page
                      ? "bg-brand-500 text-white"
                      : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/[0.03]"
                  }`}
                >
                  {pageNumber}
                </Link>
              ))}

              <Link
                href={buildHref({ page: page + 1 })}
                aria-disabled={page >= totalPages}
                className={`inline-flex h-10 items-center justify-center rounded-lg border px-3 text-sm ${
                  page >= totalPages
                    ? "pointer-events-none border-gray-200 text-gray-400 dark:border-gray-800 dark:text-gray-600"
                    : "border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]"
                }`}
              >
                Next
              </Link>
            </div>
          </div>
        </ComponentCard>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <h3 className="mt-2 text-2xl font-semibold text-gray-800 dark:text-white/90">{value}</h3>
    </div>
  );
}
