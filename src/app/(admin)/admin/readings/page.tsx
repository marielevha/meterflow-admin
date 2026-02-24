import { Metadata } from "next";
import Link from "next/link";
import { ReadingStatus } from "@prisma/client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import ComponentCard from "@/components/common/ComponentCard";
import Badge from "@/components/ui/badge/Badge";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Readings | MeterFlow Dashboard",
  description: "Readings supervision",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValue(input: string | string[] | undefined): string {
  if (Array.isArray(input)) return input[0] ?? "";
  return input ?? "";
}

function statusBadge(status: ReadingStatus) {
  if (status === ReadingStatus.VALIDATED) return "success" as const;
  if (status === ReadingStatus.FLAGGED) return "warning" as const;
  if (status === ReadingStatus.REJECTED) return "error" as const;
  if (status === ReadingStatus.PENDING) return "info" as const;
  return "light" as const;
}

export default async function ReadingsPage({ searchParams }: { searchParams: SearchParams }) {
  const resolved = await searchParams;
  const status = firstValue(resolved.status).trim() as ReadingStatus | "";
  const dateFrom = firstValue(resolved.dateFrom).trim();
  const dateTo = firstValue(resolved.dateTo).trim();

  const where = {
    deletedAt: null,
    ...(status ? { status } : {}),
    ...(dateFrom || dateTo
      ? {
          readingAt: {
            ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
            ...(dateTo ? { lte: new Date(`${dateTo}T23:59:59.999Z`) } : {}),
          },
        }
      : {}),
  };

  const [total, pending, validated, flagged, rejected, readings] = await prisma.$transaction([
    prisma.reading.count({ where: { deletedAt: null } }),
    prisma.reading.count({ where: { deletedAt: null, status: ReadingStatus.PENDING } }),
    prisma.reading.count({ where: { deletedAt: null, status: ReadingStatus.VALIDATED } }),
    prisma.reading.count({ where: { deletedAt: null, status: ReadingStatus.FLAGGED } }),
    prisma.reading.count({ where: { deletedAt: null, status: ReadingStatus.REJECTED } }),
    prisma.reading.findMany({
      where,
      orderBy: { readingAt: "desc" },
      take: 100,
      include: {
        meter: { select: { serialNumber: true, meterReference: true } },
        submittedBy: { select: { firstName: true, lastName: true, phone: true } },
        reviewedBy: { select: { firstName: true, lastName: true } },
      },
    }),
  ]);

  return (
    <div>
      <PageBreadcrumb pageTitle="Readings" />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total" value={total} />
        <StatCard label="Pending" value={pending} />
        <StatCard label="Validated" value={validated} />
        <StatCard label="Flagged" value={flagged} />
        <StatCard label="Rejected" value={rejected} />
      </div>

      <ComponentCard title="Readings queue" desc="Suivi des relevés et décisions de validation.">
        <form method="GET" className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-12">
          <div className="lg:col-span-3">
            <select
              name="status"
              defaultValue={status}
              className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
            >
              <option value="">All status</option>
              {Object.values(ReadingStatus).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-3">
            <input
              type="date"
              name="dateFrom"
              defaultValue={dateFrom}
              className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
            />
          </div>
          <div className="lg:col-span-3">
            <input
              type="date"
              name="dateTo"
              defaultValue={dateTo}
              className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
            />
          </div>
          <div className="lg:col-span-3 flex gap-2">
            <button
              type="submit"
              className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600"
            >
              Filter
            </button>
            <Link
              href="/admin/readings"
              className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]"
            >
              Reset
            </Link>
          </div>
        </form>

        <div className="max-w-full overflow-x-auto">
          <div className="min-w-[1250px] overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>
                  <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Reading date</TableCell>
                  <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Meter</TableCell>
                  <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Index</TableCell>
                  <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Status</TableCell>
                  <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Submitted by</TableCell>
                  <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Reviewed by</TableCell>
                  <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">GPS distance</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {readings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                      No reading found.
                    </TableCell>
                  </TableRow>
                ) : (
                  readings.map((reading) => {
                    const submittedBy =
                      [reading.submittedBy.firstName, reading.submittedBy.lastName]
                        .filter(Boolean)
                        .join(" ")
                        .trim() || reading.submittedBy.phone;
                    const reviewedBy =
                      [reading.reviewedBy?.firstName, reading.reviewedBy?.lastName].filter(Boolean).join(" ").trim() ||
                      "N/A";
                    return (
                      <TableRow key={reading.id}>
                        <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          {reading.readingAt.toISOString().slice(0, 19).replace("T", " ")}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          <p className="font-medium">{reading.meter.serialNumber}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{reading.meter.meterReference || "N/A"}</p>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          {reading.primaryIndex.toString()}
                          {reading.secondaryIndex ? ` | ${reading.secondaryIndex.toString()}` : ""}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm">
                          <Badge size="sm" color={statusBadge(reading.status)}>
                            {reading.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{submittedBy}</TableCell>
                        <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{reviewedBy}</TableCell>
                        <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          {reading.gpsDistanceMeters?.toString() || "N/A"}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </ComponentCard>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <h3 className="mt-2 text-2xl font-semibold text-gray-800 dark:text-white/90">{value}</h3>
    </div>
  );
}
