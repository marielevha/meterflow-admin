import { Metadata } from "next";
import Link from "next/link";
import { MeterStatus, MeterType } from "@prisma/client";
import { notFound } from "next/navigation";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Badge from "@/components/ui/badge/Badge";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Meter Details | MeterFlow Dashboard",
  description: "Meter details page",
};

function formatDate(value: Date | null) {
  if (!value) return "N/A";
  return value.toISOString().slice(0, 19).replace("T", " ");
}

function statusBadge(status: MeterStatus) {
  if (status === MeterStatus.ACTIVE) return "success" as const;
  if (status === MeterStatus.MAINTENANCE) return "warning" as const;
  if (status === MeterStatus.REPLACED) return "error" as const;
  return "light" as const;
}

function typeBadge(type: MeterType) {
  if (type === MeterType.DUAL_INDEX) return "info" as const;
  return "light" as const;
}

export default async function MeterDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const meter = await prisma.meter.findFirst({
    where: { id, deletedAt: null },
    include: {
      customer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
          city: true,
          zone: true,
        },
      },
      assignedAgent: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
        },
      },
      states: {
        where: { deletedAt: null },
        orderBy: { effectiveAt: "desc" },
        take: 5,
      },
      readings: {
        where: { deletedAt: null },
        orderBy: { readingAt: "desc" },
        take: 5,
        select: {
          id: true,
          status: true,
          primaryIndex: true,
          secondaryIndex: true,
          readingAt: true,
        },
      },
    },
  });

  if (!meter) {
    notFound();
  }

  const customerName =
    [meter.customer.firstName, meter.customer.lastName].filter(Boolean).join(" ").trim() ||
    meter.customer.phone;
  const agentName =
    [meter.assignedAgent?.firstName, meter.assignedAgent?.lastName]
      .filter(Boolean)
      .join(" ")
      .trim() || "Unassigned";

  return (
    <div>
      <PageBreadcrumb pageTitle="Meter details" />

      <div className="mb-6 flex items-center justify-end gap-2">
        <Link
          href="/admin/meters"
          className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]"
        >
          Back
        </Link>
        <Link
          href={`/admin/meters/${meter.id}/edit`}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600"
        >
          Edit meter
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <p className="text-sm text-gray-500 dark:text-gray-400">Meter ID</p>
          <p className="mt-2 break-all text-sm text-gray-800 dark:text-white/90">{meter.id}</p>
          <div className="mt-4 flex items-center gap-2">
            <Badge size="sm" color={statusBadge(meter.status)}>
              {meter.status}
            </Badge>
            <Badge size="sm" color={typeBadge(meter.type)}>
              {meter.type}
            </Badge>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] lg:col-span-2">
          <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Meter identity</h3>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Serial number" value={meter.serialNumber} />
            <Field label="Reference" value={meter.meterReference || "N/A"} />
            <Field label="Installed at" value={formatDate(meter.installedAt)} />
            <Field label="Last inspection" value={formatDate(meter.lastInspectionAt)} />
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] lg:col-span-3">
          <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Assignment & location</h3>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Field label="Customer" value={customerName} />
            <Field label="Customer contact" value={meter.customer.phone} />
            <Field label="Assigned agent" value={agentName} />
            <Field label="Address line 1" value={meter.addressLine1 || "N/A"} />
            <Field label="Address line 2" value={meter.addressLine2 || "N/A"} />
            <Field label="City / Zone" value={`${meter.city || "-"} / ${meter.zone || "-"}`} />
            <Field label="Latitude" value={meter.latitude?.toString() || "N/A"} />
            <Field label="Longitude" value={meter.longitude?.toString() || "N/A"} />
            <Field label="Created at" value={formatDate(meter.createdAt)} />
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] lg:col-span-3">
          <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Latest meter states</h3>
          <div className="mt-4 space-y-2">
            {meter.states.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No states found.</p>
            ) : (
              meter.states.map((state) => (
                <div
                  key={state.id}
                  className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-white/[0.02]"
                >
                  <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(state.effectiveAt)}</p>
                  <p className="mt-1 text-sm text-gray-800 dark:text-white/90">
                    Primary: {state.currentPrimary?.toString() || "-"} | Secondary:{" "}
                    {state.currentSecondary?.toString() || "-"}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] lg:col-span-3">
          <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Latest readings</h3>
          <div className="mt-4 space-y-2">
            {meter.readings.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No readings found.</p>
            ) : (
              meter.readings.map((reading) => (
                <div
                  key={reading.id}
                  className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-white/[0.02]"
                >
                  <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(reading.readingAt)}</p>
                  <p className="mt-1 text-sm text-gray-800 dark:text-white/90">
                    {reading.status} - Primary: {reading.primaryIndex.toString()} | Secondary:{" "}
                    {reading.secondaryIndex?.toString() || "-"}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-white/[0.02]">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-gray-800 dark:text-white/90">{value}</p>
    </div>
  );
}
