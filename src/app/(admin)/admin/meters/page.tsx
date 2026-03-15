import { Metadata } from "next";
import Link from "next/link";
import { MeterStatus } from "@prisma/client";
import { EyeIcon, PencilIcon } from "@/icons";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import ComponentCard from "@/components/common/ComponentCard";
import Badge from "@/components/ui/badge/Badge";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Meters",
  description: "Meters management view",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValue(input: string | string[] | undefined): string {
  if (Array.isArray(input)) return input[0] ?? "";
  return input ?? "";
}

function statusBadge(status: MeterStatus) {
  if (status === MeterStatus.ACTIVE) return "success" as const;
  if (status === MeterStatus.MAINTENANCE) return "warning" as const;
  if (status === MeterStatus.REPLACED) return "error" as const;
  return "light" as const;
}

export default async function MetersPage({ searchParams }: { searchParams: SearchParams }) {
  const resolved = await searchParams;
  const q = firstValue(resolved.q).trim();
  const status = firstValue(resolved.status).trim() as MeterStatus | "";

  const where = {
    deletedAt: null,
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { serialNumber: { contains: q, mode: "insensitive" as const } },
            { meterReference: { contains: q, mode: "insensitive" as const } },
            { city: { contains: q, mode: "insensitive" as const } },
            { zone: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [total, active, maintenance, replaced, meters] = await prisma.$transaction([
    prisma.meter.count({ where: { deletedAt: null } }),
    prisma.meter.count({ where: { deletedAt: null, status: MeterStatus.ACTIVE } }),
    prisma.meter.count({ where: { deletedAt: null, status: MeterStatus.MAINTENANCE } }),
    prisma.meter.count({ where: { deletedAt: null, status: MeterStatus.REPLACED } }),
    prisma.meter.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        customer: { select: { firstName: true, lastName: true, phone: true } },
        assignedAgent: { select: { firstName: true, lastName: true } },
        states: {
          where: { deletedAt: null },
          orderBy: { effectiveAt: "desc" },
          take: 1,
        },
      },
    }),
  ]);

  return (
    <div>
      <PageBreadcrumb pageTitle="Meters" />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total meters" value={total} />
        <StatCard label="Active" value={active} />
        <StatCard label="Maintenance" value={maintenance} />
        <StatCard label="Replaced" value={replaced} />
      </div>

      <ComponentCard title="Meters list" desc="Etat du parc de compteurs et affectations terrain.">
        <form method="GET" className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Search by serial, reference, city, zone"
              className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
            />
          </div>
          <div className="lg:col-span-3">
            <select
              name="status"
              defaultValue={status}
              className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
            >
              <option value="">All status</option>
              {Object.values(MeterStatus).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-1">
            <Link
              href="/admin/meters"
              className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]"
            >
              Reset
            </Link>
          </div>
        </form>

        <div className="max-w-full overflow-x-auto">
          <div className="min-w-[1200px] overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>
                  <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Meter</TableCell>
                  <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Status</TableCell>
                  <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Customer</TableCell>
                  <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Agent</TableCell>
                  <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Location</TableCell>
                  <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Last state</TableCell>
                  <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Actions</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {meters.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                      No meter found.
                    </TableCell>
                  </TableRow>
                ) : (
                  meters.map((meter) => {
                    const lastState = meter.states[0];
                    const customerName =
                      [meter.customer.firstName, meter.customer.lastName].filter(Boolean).join(" ").trim() ||
                      meter.customer.phone;
                    const agentName =
                      [meter.assignedAgent?.firstName, meter.assignedAgent?.lastName]
                        .filter(Boolean)
                        .join(" ")
                        .trim() || "Unassigned";

                    return (
                      <TableRow key={meter.id}>
                        <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          <p className="font-medium">{meter.serialNumber}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{meter.meterReference || "N/A"}</p>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm">
                          <Badge size="sm" color={statusBadge(meter.status)}>
                            {meter.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{customerName}</TableCell>
                        <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{agentName}</TableCell>
                        <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          {meter.city || "-"} / {meter.zone || "-"}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          {lastState
                            ? `${lastState.currentPrimary?.toString() || "-"}${
                                lastState.currentSecondary ? ` | ${lastState.currentSecondary.toString()}` : ""
                              }`
                            : "N/A"}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/admin/meters/${meter.id}`}
                              title="View meter"
                              aria-label="View meter"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]"
                            >
                              <EyeIcon className="h-4 w-4 fill-current" />
                            </Link>
                            <Link
                              href={`/admin/meters/${meter.id}/edit`}
                              title="Edit meter"
                              aria-label="Edit meter"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]"
                            >
                              <PencilIcon className="h-4 w-4 fill-current" />
                            </Link>
                          </div>
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
