import { Metadata } from "next";
import Link from "next/link";
import { Prisma } from "@prisma/client";
import { ReadingEventType, ReadingStatus, TaskPriority, TaskStatus } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Badge from "@/components/ui/badge/Badge";
import {
  translateMeterStatus,
  translateMeterType,
  translateReadingEventType,
  translateReadingSource,
  translateReadingStatus,
  translateReviewReasonCode,
  translateTaskPriority,
  translateTaskResolutionCode,
  translateTaskStatus,
} from "@/lib/admin-i18n/labels";
import { getAdminTranslator } from "@/lib/admin-i18n/server";
import {
  ADMIN_PERMISSION_GROUPS,
  hasAnyPermissionCode,
  requireAdminPermissions,
} from "@/lib/auth/adminPermissions";
import {
  getCurrentStaffPermissionCodes,
  staffHasAnyPermissionFromServerComponent,
} from "@/lib/auth/staffServerSession";
import { gpsThresholdMeters } from "@/lib/geo/gps";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Reading details",
  description: "Reading details and audit trail",
};

function formatDate(value: Date | null, fallback: string) {
  if (!value) return fallback;
  return value.toISOString().slice(0, 19).replace("T", " ");
}

function decimalToString(value: { toString(): string } | null, fallback: string) {
  if (!value) return fallback;
  return value.toString();
}

function decimalToNumber(value: { toString(): string } | null) {
  if (!value) return null;
  const num = Number(value.toString());
  return Number.isFinite(num) ? num : null;
}

function formatGpsPair(
  latitude: { toString(): string } | null,
  longitude: { toString(): string } | null,
  fallback: string
) {
  const lat = decimalToNumber(latitude);
  const lng = decimalToNumber(longitude);
  if (lat === null || lng === null) return fallback;
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

function readingStatusBadge(status: ReadingStatus) {
  if (status === ReadingStatus.VALIDATED) return "success" as const;
  if (status === ReadingStatus.FLAGGED) return "warning" as const;
  if (status === ReadingStatus.REJECTED) return "error" as const;
  if (status === ReadingStatus.PENDING) return "info" as const;
  return "light" as const;
}

function eventBadge(type: ReadingEventType) {
  if (type === ReadingEventType.VALIDATED) return "success" as const;
  if (type === ReadingEventType.FLAGGED || type === ReadingEventType.ANOMALY_DETECTED) {
    return "warning" as const;
  }
  if (type === ReadingEventType.REJECTED) return "error" as const;
  return "light" as const;
}

function personLabel(person?: {
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  email: string | null;
  phone: string;
} | null) {
  if (!person) return null;
  return (
    [person.firstName, person.lastName].filter(Boolean).join(" ").trim() ||
    person.username ||
    person.email ||
    person.phone ||
    null
  );
}

function humanizeKey(key: string) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replaceAll(".", " / ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

function isIsoDateString(value: string) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value);
}

function formatPayloadValue(value: Prisma.JsonValue, t: (key: string) => string): string {
  if (value === null) return t("common.notAvailable");
  if (typeof value === "string") {
    if (isIsoDateString(value)) {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) return formatDate(date, t("common.notAvailable"));
    }
    return value;
  }
  if (typeof value === "number") return value.toString();
  if (typeof value === "boolean") return value ? t("common.yes") : t("common.no");
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return value.map((item) => formatPayloadValue(item as Prisma.JsonValue, t)).join(", ");
  }
  return t("common.object");
}

function flattenPayload(
  value: Prisma.JsonValue,
  parentKey = ""
): Array<{ key: string; value: Prisma.JsonValue }> {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    if (!parentKey) return [];
    return [{ key: parentKey, value }];
  }

  const entries: Array<{ key: string; value: Prisma.JsonValue }> = [];
  for (const [key, nestedValue] of Object.entries(value)) {
    const nextKey = parentKey ? `${parentKey}.${key}` : key;
    if (nestedValue && typeof nestedValue === "object" && !Array.isArray(nestedValue)) {
      const nestedEntries = flattenPayload(nestedValue as Prisma.JsonValue, nextKey);
      if (nestedEntries.length > 0) {
        entries.push(...nestedEntries);
      } else {
        entries.push({ key: nextKey, value: nestedValue as Prisma.JsonValue });
      }
    } else {
      entries.push({ key: nextKey, value: nestedValue as Prisma.JsonValue });
    }
  }
  return entries;
}

export default async function ReadingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { t } = await getAdminTranslator();
  const staff = await requireAdminPermissions("/admin/readings", ADMIN_PERMISSION_GROUPS.readingsView);
  const permissionCodes = await getCurrentStaffPermissionCodes(staff.id);
  const canEditReading = hasAnyPermissionCode(permissionCodes, ADMIN_PERMISSION_GROUPS.readingsEditPage);
  const canViewReadingEventsAuditTrail = await staffHasAnyPermissionFromServerComponent(
    staff,
    [...ADMIN_PERMISSION_GROUPS.readingEventsView],
    { requireExplicitPermissions: true }
  );

  const { id } = await params;

  const reading = await prisma.reading.findFirst({
    where: { id, deletedAt: null },
    include: {
      meter: {
        select: {
          id: true,
          serialNumber: true,
          meterReference: true,
          type: true,
          status: true,
          city: true,
          zone: true,
          latitude: true,
          longitude: true,
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              username: true,
              email: true,
              phone: true,
            },
          },
          assignedAgent: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              username: true,
              email: true,
              phone: true,
            },
          },
        },
      },
      submittedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          username: true,
          email: true,
          phone: true,
        },
      },
      reviewedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          username: true,
          email: true,
          phone: true,
        },
      },
      events: {
        where: canViewReadingEventsAuditTrail
          ? { deletedAt: null }
          : { deletedAt: null, type: ReadingEventType.RESUBMITTED },
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              username: true,
              email: true,
              phone: true,
            },
          },
        },
      },
      tasks: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          createdAt: true,
        },
      },
      reportedTasks: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          createdAt: true,
          resolutionCode: true,
        },
      },
    },
  });

  if (!reading) notFound();
  const gpsDistance = decimalToNumber(reading.gpsDistanceMeters);
  const gpsThreshold = gpsThresholdMeters();
  const gpsWithinThreshold = gpsDistance === null ? null : gpsDistance <= gpsThreshold;
  const resubmissionEvents = reading.events.filter((event) => event.type === ReadingEventType.RESUBMITTED);
  const auditTrailEvents = canViewReadingEventsAuditTrail ? reading.events : [];
  const linkedTasks = [
    ...reading.tasks.map((task) => ({ ...task, relation: "SOURCE" as const })),
    ...reading.reportedTasks.map((task) => ({ ...task, relation: "MISSION_OUTPUT" as const })),
  ];

  return (
    <div>
      <PageBreadcrumb pageTitle={t("readings.detailPageTitle")} />

      <div className="mb-6 flex flex-wrap items-center justify-end gap-2">
        <Link
          href="/admin/readings"
          className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]"
        >
          {t("common.back")}
        </Link>
              {canEditReading ? (
                <Link
                  href={`/admin/readings/${reading.id}/edit`}
                  className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600"
                >
                  {t("readings.editReading")}
                </Link>
              ) : null}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className="xl:col-span-2 space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("readings.readingId")}</p>
                <p className="mt-1 break-all text-sm text-gray-800 dark:text-white/90">{reading.id}</p>
              </div>
              <Badge size="sm" color={readingStatusBadge(reading.status)}>
                {translateReadingStatus(reading.status, t)}
              </Badge>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <Info label={t("readings.source")} value={translateReadingSource(reading.source, t)} />
              <Info label={t("readings.readingDate")} value={formatDate(reading.readingAt, t("common.notAvailable"))} />
              <Info label={t("readings.reviewedAt")} value={formatDate(reading.reviewedAt, t("common.notAvailable"))} />
              <Info label={t("readings.primaryIndex")} value={decimalToString(reading.primaryIndex, t("common.notAvailable"))} />
              <Info label={t("readings.secondaryIndex")} value={decimalToString(reading.secondaryIndex, t("common.notAvailable"))} />
              <Info label={t("readings.confidenceScore")} value={decimalToString(reading.confidenceScore, t("common.notAvailable"))} />
              <Info label={t("readings.anomalyScore")} value={decimalToString(reading.anomalyScore, t("common.notAvailable"))} />
              <Info label={t("readings.gpsAccuracyMeters")} value={decimalToString(reading.gpsAccuracyMeters, t("common.notAvailable"))} />
              <Info label={t("readings.gpsDistance")} value={decimalToString(reading.gpsDistanceMeters, t("common.notAvailable"))} />
            </div>

            {(reading.flagReason || reading.rejectionReason) ? (
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <Info label={t("readings.flagReason")} value={translateReviewReasonCode(reading.flagReason, t)} />
                <Info
                  label={t("readings.rejectionReason")}
                  value={translateReviewReasonCode(reading.rejectionReason, t)}
                />
              </div>
            ) : null}

            <div
              className={`mt-4 rounded-xl border p-4 ${
                gpsWithinThreshold === false
                  ? "border-warning-200 bg-warning-50 dark:border-warning-500/30 dark:bg-warning-500/10"
                  : "border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-white/[0.02]"
              }`}
            >
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {t("readings.gpsProximityCheck")}
              </p>
              <p className="mt-2 text-sm font-semibold text-gray-800 dark:text-white/90">
                {gpsDistance === null
                  ? t("readings.distanceUnavailable")
                  : t("readings.distanceFromMeter", { value: gpsDistance.toFixed(1) })}
              </p>
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                {gpsDistance === null
                  ? t("readings.gpsIncomplete")
                  : gpsWithinThreshold
                    ? t("readings.gpsWithinThreshold", { threshold: gpsThreshold })
                    : t("readings.gpsOverThreshold", { threshold: gpsThreshold })}
              </p>
            </div>

            {reading.ocrText ? (
              <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-white/[0.02]">
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("readings.ocrText")}</p>
                <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{reading.ocrText}</p>
              </div>
            ) : null}

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-white/[0.02]">
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("readings.gpsSnapshot")}</p>
                <div className="mt-3 grid grid-cols-1 gap-3">
                  <Info label={t("readings.meterCoordinates")} value={formatGpsPair(reading.meter.latitude, reading.meter.longitude, t("common.notAvailable"))} />
                  <Info label={t("readings.readingCoordinates")} value={formatGpsPair(reading.gpsLatitude, reading.gpsLongitude, t("common.notAvailable"))} />
                  <Info label={t("readings.gpsAccuracyMeters")} value={decimalToString(reading.gpsAccuracyMeters, t("common.notAvailable"))} />
                </div>
              </div>

              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-white/[0.02]">
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("readings.resubmissionHistory")}</p>
                <p className="mt-2 text-sm font-semibold text-gray-800 dark:text-white/90">
                  {t("readings.resubmissionCount", {
                    count: resubmissionEvents.length,
                    suffix: resubmissionEvents.length > 1 ? "s" : "",
                  })}
                </p>
                {resubmissionEvents.length === 0 ? (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t("readings.notResubmitted")}</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {resubmissionEvents.map((event) => (
                      <div key={event.id} className="rounded-lg border border-gray-100 bg-white px-3 py-2 dark:border-gray-800 dark:bg-white/[0.03]">
                        <p className="text-xs font-medium text-gray-700 dark:text-gray-200">{formatDate(event.createdAt, t("common.notAvailable"))}</p>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {t("readings.byUser", { user: personLabel(event.user) || t("common.notAvailable") })}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">{t("readings.evidence")}</h3>
            <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
              <img
                src={`/api/v1/readings/${reading.id}/image`}
                alt={`Reading ${reading.id}`}
                className="h-auto w-full object-cover"
              />
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            </div>
          </div>

          {canViewReadingEventsAuditTrail ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
              <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">{t("readings.auditTrail")}</h3>
              <div className="mt-4 space-y-3">
                {auditTrailEvents.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t("readings.noEventFound")}</p>
                ) : (
                  auditTrailEvents.map((event) => {
                    const payloadEntries = flattenPayload(event.payload as Prisma.JsonValue);
                    return (
                      <div key={event.id} className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Badge size="sm" color={eventBadge(event.type)}>
                            {translateReadingEventType(event.type, t)}
                          </Badge>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(event.createdAt, t("common.notAvailable"))}</p>
                        </div>
                        <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                          {t("readings.byUser", { user: personLabel(event.user) || t("common.notAvailable") })}
                        </p>
                        <div className="mt-3 rounded-lg border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-white/[0.02]">
                          {payloadEntries.length === 0 ? (
                            <p className="text-xs text-gray-500 dark:text-gray-400">{t("readings.noAdditionalDetails")}</p>
                          ) : (
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                              {payloadEntries.map((item) => (
                                <div
                                  key={`${event.id}-${item.key}`}
                                  className="rounded-md border border-gray-100 bg-white px-3 py-2 dark:border-gray-800 dark:bg-white/[0.03]"
                                >
                                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                    {humanizeKey(item.key)}
                                  </p>
                                  <p className="mt-1 break-words text-xs font-medium text-gray-700 dark:text-gray-200">
                                    {formatPayloadValue(item.value, t)}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : null}
        </section>

        <aside className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">{t("readings.actors")}</h3>
            <div className="mt-4 space-y-3">
              <Info label={t("readings.submittedBy")} value={personLabel(reading.submittedBy) || t("common.notAvailable")} />
              <Info label={t("readings.reviewedBy")} value={personLabel(reading.reviewedBy) || t("common.notAvailable")} />
              <Info label={t("common.customer")} value={personLabel(reading.meter.customer) || t("common.notAvailable")} />
              <Info label={t("readings.assignedAgent")} value={personLabel(reading.meter.assignedAgent) || t("common.notAvailable")} />
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">{t("readings.meterDetails")}</h3>
            <div className="mt-4 space-y-3">
              <Info label={t("readings.serial")} value={reading.meter.serialNumber} />
              <Info label={t("meters.reference")} value={reading.meter.meterReference || t("common.notAvailable")} />
              <Info label={t("readings.meterType")} value={translateMeterType(reading.meter.type, t)} />
              <Info label={t("common.status")} value={translateMeterStatus(reading.meter.status, t)} />
              <Info label={t("readings.cityZone")} value={`${reading.meter.city || "-"} / ${reading.meter.zone || "-"}`} />
              <Info label={t("readings.meterCoordinates")} value={formatGpsPair(reading.meter.latitude, reading.meter.longitude, t("common.notAvailable"))} />
              <Info label={t("readings.readingCoordinates")} value={formatGpsPair(reading.gpsLatitude, reading.gpsLongitude, t("common.notAvailable"))} />
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">{t("readings.linkedTasks")}</h3>
              <span className="text-xs text-gray-500 dark:text-gray-400">{linkedTasks.length}</span>
            </div>
            {linkedTasks.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">{t("readings.noLinkedTask")}</p>
            ) : (
              <div className="space-y-2">
                {linkedTasks.map((task) => (
                  <Link
                    key={`${task.relation}-${task.id}`}
                    href={`/admin/tasks/${task.id}`}
                    className="block rounded-lg border border-gray-200 p-3 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-white/[0.03]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-gray-800 dark:text-white/90">{task.title}</p>
                      <Badge size="sm" color={task.relation === "MISSION_OUTPUT" ? "success" : "info"}>
                        {task.relation === "MISSION_OUTPUT" ? t("readings.missionOutput") : t("readings.sourceTask")}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {translateTaskStatus(task.status as TaskStatus, t)} - {translateTaskPriority(task.priority as TaskPriority, t)} - {formatDate(task.createdAt, t("common.notAvailable"))}
                    </p>
                    {"resolutionCode" in task && task.resolutionCode ? (
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {t("readings.taskOutcome")}: {translateTaskResolutionCode(task.resolutionCode, t)}
                      </p>
                    ) : null}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Info({
  label,
  value,
  breakAll = false,
}: {
  label: string;
  value: string;
  breakAll?: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-white/[0.02]">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`mt-1 text-sm font-medium text-gray-800 dark:text-white/90 ${breakAll ? "break-all" : ""}`}>
        {value}
      </p>
    </div>
  );
}
