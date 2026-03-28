import { Metadata } from "next";
import Link from "next/link";
import { ReadingStatus } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Badge from "@/components/ui/badge/Badge";
import {
  translateMeterStatus,
  translateMeterType,
  translateReadingSource,
  translateReadingStatus,
} from "@/lib/admin-i18n/labels";
import { getAdminTranslator } from "@/lib/admin-i18n/server";
import {
  ADMIN_PERMISSION_GROUPS,
  hasAnyPermissionCode,
  requireAdminPermissions,
} from "@/lib/auth/adminPermissions";
import { getCurrentStaffPermissionCodes } from "@/lib/auth/staffServerSession";
import { gpsThresholdMeters } from "@/lib/geo/gps";
import { activeMeterAssignmentCustomerSelect, getActiveMeterCustomer } from "@/lib/meters/assignments";
import { prisma } from "@/lib/prisma";
import {
  FLAG_REASON_OPTIONS,
  REJECTION_REASON_OPTIONS,
} from "@/lib/readings/reviewReasons";
import { updateReadingAction } from "./actions";
import ReadingDecisionFields from "./ReadingDecisionFields";

export const metadata: Metadata = {
  title: "Edit reading",
  description: "Edit meter reading",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function formatDateTime(value: Date | null, fallback: string) {
  if (!value) return fallback;
  return value.toISOString().slice(0, 19).replace("T", " ");
}

function decimalToInput(value: { toString(): string } | null) {
  return value ? value.toString() : "";
}

function decimalToNumber(value: { toString(): string } | null) {
  if (!value) return null;
  const numeric = Number(value.toString());
  return Number.isFinite(numeric) ? numeric : null;
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

function mapError(code: string, t: (key: string) => string) {
  if (!code) return "";
  if (code === "invalid_status") return t("readings.errorInvalidStatus");
  if (code === "invalid_status_transition") return t("readings.errorInvalidStatusTransition");
  if (code === "invalid_primary_index") return t("readings.errorInvalidPrimaryIndex");
  if (code === "invalid_secondary_index") return t("readings.errorInvalidSecondaryIndex");
  if (code === "invalid_gps_latitude") return t("readings.errorInvalidGpsLatitude");
  if (code === "invalid_gps_longitude") return t("readings.errorInvalidGpsLongitude");
  if (code === "invalid_gps_accuracy") return t("readings.errorInvalidGpsAccuracy");
  if (code === "invalid_gps_distance") return t("readings.errorInvalidGpsDistance");
  if (code === "flag_reason_required") return t("readings.errorFlagReasonRequired");
  if (code === "rejection_reason_required") return t("readings.errorRejectionReasonRequired");
  if (code === "invalid_flag_reason") return t("readings.errorInvalidFlagReason");
  if (code === "invalid_rejection_reason") return t("readings.errorInvalidRejectionReason");
  if (code === "update_failed") return t("readings.errorUpdateFailed");
  return code.replaceAll("_", " ");
}

export default async function EditReadingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const { t } = await getAdminTranslator();
  const staff = await requireAdminPermissions("/admin/readings", ADMIN_PERMISSION_GROUPS.readingsEditPage);
  const permissionCodes = await getCurrentStaffPermissionCodes(staff.id);

  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const error = mapError(firstValue(resolvedSearchParams.error), t);

  const reading = await prisma.reading.findFirst({
    where: { id, deletedAt: null },
    include: {
      meter: {
        select: {
          serialNumber: true,
          meterReference: true,
          type: true,
          status: true,
          city: true,
          zone: true,
          addressLine1: true,
          addressLine2: true,
          latitude: true,
          longitude: true,
          assignedAgent: {
            select: {
              firstName: true,
              lastName: true,
              username: true,
              email: true,
              phone: true,
            },
          },
          ...activeMeterAssignmentCustomerSelect,
        },
      },
      submittedBy: {
        select: {
          firstName: true,
          lastName: true,
          username: true,
          email: true,
          phone: true,
        },
      },
      reviewedBy: {
        select: {
          firstName: true,
          lastName: true,
          username: true,
          email: true,
          phone: true,
        },
      },
    },
  });

  if (!reading) notFound();
  const activeCustomer = getActiveMeterCustomer(reading.meter);

  const submit = updateReadingAction.bind(null, reading.id);
  const canEditGps = hasAnyPermissionCode(permissionCodes, ADMIN_PERMISSION_GROUPS.readingsUpdate);
  const canValidateReading = hasAnyPermissionCode(
    permissionCodes,
    ADMIN_PERMISSION_GROUPS.readingsValidate
  );
  const canFlagReading = hasAnyPermissionCode(permissionCodes, ADMIN_PERMISSION_GROUPS.readingsFlag);
  const canRejectReading = hasAnyPermissionCode(
    permissionCodes,
    ADMIN_PERMISSION_GROUPS.readingsReject
  );
  const gpsDistance = decimalToNumber(reading.gpsDistanceMeters);
  const gpsThreshold = gpsThresholdMeters();
  const gpsExceeded = gpsDistance !== null && gpsDistance > gpsThreshold;
  const allowedReviewStatuses = [
    reading.status,
    ...(canValidateReading ? [ReadingStatus.VALIDATED] : []),
    ...(canFlagReading ? [ReadingStatus.FLAGGED] : []),
    ...(canRejectReading ? [ReadingStatus.REJECTED] : []),
  ].filter((status, index, source) => source.indexOf(status) === index);

  return (
    <div>
      <PageBreadcrumb pageTitle={t("readings.reviewPageTitle")} />

      <form action={submit} className="space-y-6">
        {error ? (
          <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300">
            {error}
          </div>
        ) : null}

        <div className="mb-2 flex flex-wrap items-center justify-end gap-2">
          <Link
            href={`/admin/readings/${reading.id}`}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]"
          >
            {t("readings.backToDetails")}
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <section className="space-y-6 xl:col-span-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
              <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">{t("readings.reviewDecision")}</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {t("readings.reviewDecisionDesc")}
              </p>

              <div className="mt-4">
                <ReadingDecisionFields
                  allowedStatuses={allowedReviewStatuses}
                  defaultStatus={reading.status}
                  defaultFlagReason={reading.flagReason || ""}
                  defaultRejectionReason={reading.rejectionReason || ""}
                  flagOptions={FLAG_REASON_OPTIONS}
                  rejectionOptions={REJECTION_REASON_OPTIONS}
                />
              </div>

              <div className="mt-6 border-t border-gray-100 pt-6 dark:border-gray-800">
                <div className="mb-3">
                  <h4 className="text-sm font-semibold text-gray-800 dark:text-white/90">{t("readings.indexesSectionTitle")}</h4>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {t("readings.indexesSectionDesc")}
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label
                      htmlFor="primaryIndex"
                      className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400"
                    >
                      {t("readings.primaryIndex")}
                    </label>
                    <input
                      id="primaryIndex"
                      name="primaryIndex"
                      type="number"
                      step={0.001}
                      min="0"
                      defaultValue={decimalToInput(reading.primaryIndex)}
                      required
                      className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                    />
                  </div>

                  {reading.meter.type === "DUAL_INDEX" || reading.secondaryIndex !== null ? (
                    <div>
                      <label
                        htmlFor="secondaryIndex"
                        className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400"
                      >
                        {t("readings.secondaryIndex")}
                      </label>
                      <input
                        id="secondaryIndex"
                        name="secondaryIndex"
                        type="number"
                        step={0.001}
                        min="0"
                        defaultValue={decimalToInput(reading.secondaryIndex)}
                        className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div
              className={`rounded-2xl border p-6 ${
                gpsExceeded
                  ? "border-warning-200 bg-warning-50/60 dark:border-warning-500/30 dark:bg-warning-500/10"
                  : "border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]"
              }`}
            >
              <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">{t("readings.gpsLocation")}</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {canEditGps
                  ? t("readings.gpsEditable")
                  : t("readings.gpsRestricted")}
              </p>
              {gpsExceeded ? (
                <div className="mt-4 rounded-xl border border-warning-200 bg-white/70 px-4 py-3 text-sm text-warning-800 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-200">
                  {t("readings.gpsExceededWarning", { threshold: gpsThreshold })}
                  {gpsDistance !== null ? ` ${t("readings.gpsCurrentValue", { value: gpsDistance.toFixed(1) })}` : ""}
                </div>
              ) : null}

              <div
                className={`mt-4 rounded-xl px-4 py-3 ${
                  gpsExceeded
                    ? "border border-warning-200 bg-white/70 dark:border-warning-500/30 dark:bg-white/5"
                    : "border border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-white/[0.02]"
                }`}
              >
                <p className="text-xs text-gray-500 dark:text-gray-400">{t("readings.meterCoordinates")}</p>
                <p className="mt-1 text-sm font-medium text-gray-800 dark:text-white/90">
                  {formatGpsPair(reading.meter.latitude, reading.meter.longitude, t("common.notAvailable"))}
                </p>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                {canEditGps ? (
                  <>
                    <div>
                      <label
                        htmlFor="gpsLatitude"
                        className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400"
                      >
                        {t("readings.gpsLatitude")}
                      </label>
                      <input
                        id="gpsLatitude"
                        name="gpsLatitude"
                        type="number"
                        step="0.0000001"
                        defaultValue={decimalToInput(reading.gpsLatitude)}
                        className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="gpsLongitude"
                        className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400"
                      >
                        {t("readings.gpsLongitude")}
                      </label>
                      <input
                        id="gpsLongitude"
                        name="gpsLongitude"
                        type="number"
                        step="0.0000001"
                        defaultValue={decimalToInput(reading.gpsLongitude)}
                        className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="gpsAccuracyMeters"
                        className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400"
                      >
                        {t("readings.gpsAccuracyMeters")}
                      </label>
                      <input
                        id="gpsAccuracyMeters"
                        name="gpsAccuracyMeters"
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={decimalToInput(reading.gpsAccuracyMeters)}
                        className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="gpsDistanceMeters"
                        className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400"
                      >
                        {t("readings.gpsDistance")}
                      </label>
                      <input
                        id="gpsDistanceMeters"
                        name="gpsDistanceMeters"
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={decimalToInput(reading.gpsDistanceMeters)}
                        className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <Info label={t("readings.readingCoordinates")} value={formatGpsPair(reading.gpsLatitude, reading.gpsLongitude, t("common.notAvailable"))} />
                    <Info label={t("readings.gpsAccuracyMeters")} value={reading.gpsAccuracyMeters?.toString() || t("common.notAvailable")} />
                    <Info label={t("readings.gpsDistance")} value={reading.gpsDistanceMeters?.toString() || t("common.notAvailable")} />
                  </>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
              <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">{t("readings.scoringAnalysis")}</h3>
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <Info label={t("readings.confidenceScore")} value={reading.confidenceScore?.toString() || t("common.notAvailable")} />
                <Info label={t("readings.anomalyScore")} value={reading.anomalyScore?.toString() || t("common.notAvailable")} />
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">{t("readings.evidence")}</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {t("readings.evidenceDesc")}
                  </p>
                </div>
              </div>

              <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
                <img
                  src={`/api/v1/readings/${reading.id}/image`}
                  alt={`Reading ${reading.id}`}
                  className="h-auto max-h-[420px] w-full object-cover"
                />
              </div>
            </div>
          </section>

          <aside className="space-y-6">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
              <div className="mb-4 flex items-start justify-between gap-3">
                <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">{t("readings.readingSummary")}</h3>
                <Badge size="sm" color={readingStatusBadge(reading.status)}>
                  {translateReadingStatus(reading.status, t)}
                </Badge>
              </div>
              <div className="space-y-3">
                <Info label={t("readings.readingId")} value={reading.id} breakAll />
                <Info
                  label={t("readings.serialReference")}
                  value={`${reading.meter.serialNumber} / ${reading.meter.meterReference || t("common.notAvailable")}`}
                />
                <Info label={t("readings.readingDate")} value={formatDateTime(reading.readingAt, t("common.notAvailable"))} />
                <Info label={t("readings.source")} value={translateReadingSource(reading.source, t)} />
                <Info label={t("readings.meterType")} value={translateMeterType(reading.meter.type, t)} />
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
              <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">{t("readings.actors")}</h3>
              <div className="mt-4 space-y-3">
                <Info label={t("readings.submittedBy")} value={personLabel(reading.submittedBy) || t("common.notAvailable")} />
                <Info label={t("readings.reviewedBy")} value={personLabel(reading.reviewedBy) || t("common.notAvailable")} />
                <Info label={t("common.customer")} value={personLabel(activeCustomer) || t("common.notAvailable")} />
                <Info label={t("readings.assignedAgent")} value={personLabel(reading.meter.assignedAgent) || t("common.notAvailable")} />
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
              <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">{t("readings.meterDetails")}</h3>
              <div className="mt-4 space-y-3">
                <Info label={t("readings.serial")} value={reading.meter.serialNumber} />
                <Info label={t("meters.reference")} value={reading.meter.meterReference || t("common.notAvailable")} />
                <Info label={t("common.type")} value={translateMeterType(reading.meter.type, t)} />
                <Info label={t("common.status")} value={translateMeterStatus(reading.meter.status, t)} />
                <Info label={t("readings.cityZone")} value={`${reading.meter.city || "-"} / ${reading.meter.zone || "-"}`} />
                <Info
                  label={t("readings.address")}
                  value={[reading.meter.addressLine1, reading.meter.addressLine2].filter(Boolean).join(", ") || t("common.notAvailable")}
                />
                <Info label={t("readings.meterCoordinates")} value={formatGpsPair(reading.meter.latitude, reading.meter.longitude, t("common.notAvailable"))} />
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
              <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">{t("readings.systemContext")}</h3>
              <div className="mt-4 space-y-3">
                <Info label={t("readings.source")} value={translateReadingSource(reading.source, t)} />
                <Info label={t("readings.reviewedAt")} value={formatDateTime(reading.reviewedAt, t("common.notAvailable"))} />
                <Info label={t("readings.updatedAt")} value={formatDateTime(reading.updatedAt, t("common.notAvailable"))} />
              </div>
            </div>
          </aside>
        </div>

        <div className="sticky bottom-4 z-30 rounded-xl border border-gray-200 bg-white/90 p-4 backdrop-blur dark:border-gray-800 dark:bg-gray-900/90">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link
              href={`/admin/readings/${reading.id}`}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]"
            >
              {t("common.cancel")}
            </Link>
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600"
            >
              {t("common.save")}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function personLabel(person?: {
  firstName: string | null;
  lastName: string | null;
  username?: string | null;
  email?: string | null;
  phone: string | null;
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
