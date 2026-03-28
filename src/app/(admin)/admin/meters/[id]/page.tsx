import { Metadata } from "next";
import Link from "next/link";
import { MeterStatus, MeterType, UserRole } from "@prisma/client";
import { notFound } from "next/navigation";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import MeterAssignmentWorkflowCard from "@/components/meters/MeterAssignmentWorkflowCard";
import Badge from "@/components/ui/badge/Badge";
import { getAdminTranslator } from "@/lib/admin-i18n/server";
import {
  translateMeterAssignmentSource,
  translateMeterStatus,
  translateMeterType,
} from "@/lib/admin-i18n/labels";
import {
  ADMIN_PERMISSION_GROUPS,
  hasAnyPermissionCode,
  requireAdminPermissions,
} from "@/lib/auth/adminPermissions";
import { getCurrentStaffPermissionCodes } from "@/lib/auth/staffServerSession";
import { getMeterAssignmentTransferBlockers } from "@/lib/meters/assignments";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Meter Details",
  description: "Meter details page",
};

function formatDate(value: Date | null, fallback: string) {
  if (!value) return fallback;
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
  const staff = await requireAdminPermissions("/admin/meters", ADMIN_PERMISSION_GROUPS.metersView);
  const permissionCodes = await getCurrentStaffPermissionCodes(staff.id);
  const canEditMeters = hasAnyPermissionCode(permissionCodes, ADMIN_PERMISSION_GROUPS.metersEdit);
  const { t } = await getAdminTranslator();
  const { id } = await params;
  const [meter, currentAssignment, assignmentHistory, transferCustomers, blockers] = await Promise.all([
    prisma.meter.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        serialNumber: true,
        meterReference: true,
        type: true,
        status: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        zone: true,
        latitude: true,
        longitude: true,
        installedAt: true,
        lastInspectionAt: true,
        createdAt: true,
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
    }),
    prisma.meterAssignment.findFirst({
      where: {
        meterId: id,
        endedAt: null,
        deletedAt: null,
      },
      orderBy: [{ assignedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        customerId: true,
        assignedAt: true,
        source: true,
        notes: true,
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            phone: true,
          },
        },
      },
    }),
    prisma.meterAssignment.findMany({
      where: {
        meterId: id,
        deletedAt: null,
      },
      orderBy: [{ assignedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        assignedAt: true,
        endedAt: true,
        source: true,
        notes: true,
        customer: {
          select: {
            firstName: true,
            lastName: true,
            username: true,
            phone: true,
          },
        },
        assignedBy: {
          select: {
            firstName: true,
            lastName: true,
            username: true,
            phone: true,
          },
        },
        endedBy: {
          select: {
            firstName: true,
            lastName: true,
            username: true,
            phone: true,
          },
        },
      },
    }),
    canEditMeters
      ? prisma.user.findMany({
          where: {
            deletedAt: null,
            role: UserRole.CLIENT,
          },
          orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        })
      : Promise.resolve([]),
    getMeterAssignmentTransferBlockers(id),
  ]);

  if (!meter) {
    notFound();
  }

  const customer = currentAssignment?.customer ?? null;
  const customerName =
    (customer
      ? [customer.firstName, customer.lastName].filter(Boolean).join(" ").trim() || customer.phone
      : "") || t("meters.unassigned");
  const agentName =
    [meter.assignedAgent?.firstName, meter.assignedAgent?.lastName]
      .filter(Boolean)
      .join(" ")
      .trim() || t("meters.unassigned");
  const customerOptions = transferCustomers
    .filter((entry) => entry.id !== currentAssignment?.customerId)
    .map((entry) => ({
      value: entry.id,
      label: [entry.firstName, entry.lastName].filter(Boolean).join(" ").trim() || t("common.customer"),
      hint: entry.phone,
    }));
  const history = assignmentHistory.map((entry) => ({
    id: entry.id,
    customerName:
      [entry.customer.firstName, entry.customer.lastName].filter(Boolean).join(" ").trim() ||
      entry.customer.username ||
      entry.customer.phone ||
      t("meters.unassigned"),
    customerPhone: entry.customer.phone,
    assignedAt: entry.assignedAt.toISOString(),
    endedAt: entry.endedAt ? entry.endedAt.toISOString() : null,
    sourceLabel: translateMeterAssignmentSource(entry.source, t),
    notes: entry.notes,
    assignedByName:
      (entry.assignedBy
        ? [entry.assignedBy.firstName, entry.assignedBy.lastName].filter(Boolean).join(" ").trim() ||
          entry.assignedBy.username ||
          entry.assignedBy.phone
        : null) || null,
    endedByName:
      (entry.endedBy
        ? [entry.endedBy.firstName, entry.endedBy.lastName].filter(Boolean).join(" ").trim() ||
          entry.endedBy.username ||
          entry.endedBy.phone
        : null) || null,
    isActive: !entry.endedAt,
  }));

  return (
    <div>
      <PageBreadcrumb pageTitle={t("meters.detailsPageTitle")} />

      <div className="mb-6 flex items-center justify-end gap-2">
        <Link
          href="/admin/meters"
          className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]"
        >
          {t("common.back")}
        </Link>
        {canEditMeters ? (
          <Link
            href={`/admin/meters/${meter.id}/edit`}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600"
          >
            {t("common.edit")}
          </Link>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t("meters.meterId")}</p>
          <p className="mt-2 break-all text-sm text-gray-800 dark:text-white/90">{meter.id}</p>
          <div className="mt-4 flex items-center gap-2">
            <Badge size="sm" color={statusBadge(meter.status)}>
              {translateMeterStatus(meter.status, t)}
            </Badge>
            <Badge size="sm" color={typeBadge(meter.type)}>
              {translateMeterType(meter.type, t)}
            </Badge>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] lg:col-span-2">
          <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">{t("meters.meterIdentity")}</h3>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("meters.serialNumber")} value={meter.serialNumber} />
            <Field label={t("meters.reference")} value={meter.meterReference || t("common.notAvailable")} />
            <Field label={t("meters.installedAt")} value={formatDate(meter.installedAt, t("common.notAvailable"))} />
            <Field label={t("meters.lastInspection")} value={formatDate(meter.lastInspectionAt, t("common.notAvailable"))} />
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] lg:col-span-3">
          <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">{t("meters.assignmentLocation")}</h3>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Field label={t("common.customer")} value={customerName} />
            <Field label={t("meters.customerContact")} value={customer?.phone || t("common.notAvailable")} />
            <Field label={t("meters.assignedAgent")} value={agentName} />
            <Field
              label={t("meters.assignmentSourceLabel")}
              value={currentAssignment ? translateMeterAssignmentSource(currentAssignment.source, t) : t("common.notAvailable")}
            />
            <Field
              label={t("meters.assignmentDateLabel")}
              value={currentAssignment ? formatDate(currentAssignment.assignedAt, t("common.notAvailable")) : t("common.notAvailable")}
            />
            <Field label={t("meters.addressLine1")} value={meter.addressLine1 || t("common.notAvailable")} />
            <Field label={t("meters.addressLine2")} value={meter.addressLine2 || t("common.notAvailable")} />
            <Field label={t("meters.cityZone")} value={`${meter.city || "-"} / ${meter.zone || "-"}`} />
            <Field label={t("meters.latitude")} value={meter.latitude?.toString() || t("common.notAvailable")} />
            <Field label={t("meters.longitude")} value={meter.longitude?.toString() || t("common.notAvailable")} />
            <Field label={t("meters.createdAt")} value={formatDate(meter.createdAt, t("common.notAvailable"))} />
          </div>
        </div>

        <MeterAssignmentWorkflowCard
          meterId={meter.id}
          serialNumber={meter.serialNumber}
          canManage={canEditMeters}
          currentAssignment={
            currentAssignment
              ? {
                  customerId: currentAssignment.customerId,
                  customerName,
                  customerPhone: currentAssignment.customer.phone,
                  assignedAt: currentAssignment.assignedAt.toISOString(),
                  sourceLabel: translateMeterAssignmentSource(currentAssignment.source, t),
                  notes: currentAssignment.notes,
                }
              : null
          }
          blockers={blockers}
          customerOptions={customerOptions}
          history={history}
        />

        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] lg:col-span-3">
          <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">{t("meters.latestStates")}</h3>
          <div className="mt-4 space-y-2">
            {meter.states.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">{t("meters.noStatesFound")}</p>
            ) : (
              meter.states.map((state) => (
                <div
                  key={state.id}
                  className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-white/[0.02]"
                >
                  <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(state.effectiveAt, t("common.notAvailable"))}</p>
                  <p className="mt-1 text-sm text-gray-800 dark:text-white/90">
                    {t("meters.lastStateFormat", {
                      primary: state.currentPrimary?.toString() || "-",
                      secondary: state.currentSecondary?.toString() || "-",
                    })}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] lg:col-span-3">
          <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">{t("meters.latestReadings")}</h3>
          <div className="mt-4 space-y-2">
            {meter.readings.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">{t("meters.noReadingsFound")}</p>
            ) : (
              meter.readings.map((reading) => (
                <div
                  key={reading.id}
                  className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-white/[0.02]"
                >
                  <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(reading.readingAt, t("common.notAvailable"))}</p>
                  <p className="mt-1 text-sm text-gray-800 dark:text-white/90">
                    {t("meters.lastReadingFormat", {
                      status: reading.status,
                      primary: reading.primaryIndex.toString(),
                      secondary: reading.secondaryIndex?.toString() || "-",
                    })}
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
