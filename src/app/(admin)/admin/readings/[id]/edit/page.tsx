import { Metadata } from "next";
import Link from "next/link";
import { ReadingStatus, UserRole } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Badge from "@/components/ui/badge/Badge";
import { getCurrentStaffFromServerAction } from "@/lib/auth/staffActionSession";
import { gpsThresholdMeters } from "@/lib/geo/gps";
import { prisma } from "@/lib/prisma";
import {
  FLAG_REASON_OPTIONS,
  REJECTION_REASON_OPTIONS,
} from "@/lib/readings/reviewReasons";
import { isReadingTransitionAllowed } from "@/lib/workflows/stateMachines";
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

function formatDateTime(value: Date | null) {
  if (!value) return "N/A";
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
  longitude: { toString(): string } | null
) {
  const lat = decimalToNumber(latitude);
  const lng = decimalToNumber(longitude);
  if (lat === null || lng === null) return "N/A";
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

function readingStatusBadge(status: ReadingStatus) {
  if (status === ReadingStatus.VALIDATED) return "success" as const;
  if (status === ReadingStatus.FLAGGED) return "warning" as const;
  if (status === ReadingStatus.REJECTED) return "error" as const;
  if (status === ReadingStatus.PENDING) return "info" as const;
  return "light" as const;
}

function mapError(code: string) {
  if (!code) return "";
  if (code === "invalid_status") return "Invalid status selected.";
  if (code === "invalid_status_transition") return "This status transition is not allowed.";
  if (code === "invalid_primary_index") return "Primary index is invalid.";
  if (code === "invalid_secondary_index") return "Secondary index is invalid.";
  if (code === "invalid_gps_latitude") return "GPS latitude is invalid.";
  if (code === "invalid_gps_longitude") return "GPS longitude is invalid.";
  if (code === "invalid_gps_accuracy") return "GPS accuracy is invalid.";
  if (code === "invalid_gps_distance") return "GPS distance is invalid.";
  if (code === "flag_reason_required") return "Select a normalized flag reason when status is Flagged.";
  if (code === "rejection_reason_required") return "Select a normalized rejection reason when status is Rejected.";
  if (code === "invalid_flag_reason") return "The selected flag reason is invalid.";
  if (code === "invalid_rejection_reason") return "The selected rejection reason is invalid.";
  if (code === "update_failed") return "Update failed. Please try again.";
  return code.replaceAll("_", " ");
}

export default async function EditReadingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const staff = await getCurrentStaffFromServerAction();
  if (!staff) redirect("/signin");

  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const error = mapError(firstValue(resolvedSearchParams.error));

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
          customer: {
            select: {
              firstName: true,
              lastName: true,
              username: true,
              email: true,
              phone: true,
            },
          },
          assignedAgent: {
            select: {
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

  const submit = updateReadingAction.bind(null, reading.id);
  const canEditGps = staff.role === UserRole.ADMIN || staff.role === UserRole.SUPERVISOR;
  const gpsDistance = decimalToNumber(reading.gpsDistanceMeters);
  const gpsThreshold = gpsThresholdMeters();
  const gpsExceeded = gpsDistance !== null && gpsDistance > gpsThreshold;
  const allowedReviewStatuses = [
    reading.status,
    ReadingStatus.VALIDATED,
    ReadingStatus.FLAGGED,
    ReadingStatus.REJECTED,
  ].filter((status, index, source) => {
    return (
      source.indexOf(status) === index &&
      (status === reading.status || isReadingTransitionAllowed(staff.role, reading.status, status))
    );
  });

  return (
    <div>
      <PageBreadcrumb pageTitle="Review reading" />

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
            Back to details
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <section className="space-y-6 xl:col-span-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
              <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Review decision</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Status, decision reasons, and reading indexes can be adjusted here. The rest of the reading stays
                read-only.
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
                  <h4 className="text-sm font-semibold text-gray-800 dark:text-white/90">Reading indexes</h4>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    These values can be corrected during review by admins, supervisors, and agents.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label
                      htmlFor="primaryIndex"
                      className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400"
                    >
                      Primary index
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
                        Secondary index
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
              <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">GPS & location</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {canEditGps
                  ? "Supervisors and admins can correct GPS values directly in this block when needed."
                  : "GPS correction is restricted to supervisors and admins."}
              </p>
              {gpsExceeded ? (
                <div className="mt-4 rounded-xl border border-warning-200 bg-white/70 px-4 py-3 text-sm text-warning-800 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-200">
                  GPS distance exceeds the configured threshold ({gpsThreshold} m).
                  {gpsDistance !== null ? ` Current value: ${gpsDistance.toFixed(1)} m.` : ""}
                </div>
              ) : null}

              <div
                className={`mt-4 rounded-xl px-4 py-3 ${
                  gpsExceeded
                    ? "border border-warning-200 bg-white/70 dark:border-warning-500/30 dark:bg-white/5"
                    : "border border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-white/[0.02]"
                }`}
              >
                <p className="text-xs text-gray-500 dark:text-gray-400">Meter coordinates</p>
                <p className="mt-1 text-sm font-medium text-gray-800 dark:text-white/90">
                  {formatGpsPair(reading.meter.latitude, reading.meter.longitude)}
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
                        GPS latitude
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
                        GPS longitude
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
                        GPS accuracy (m)
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
                        GPS distance (m)
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
                    <Info label="Reading coordinates" value={formatGpsPair(reading.gpsLatitude, reading.gpsLongitude)} />
                    <Info label="GPS accuracy (m)" value={reading.gpsAccuracyMeters?.toString() || "N/A"} />
                    <Info label="GPS distance (m)" value={reading.gpsDistanceMeters?.toString() || "N/A"} />
                  </>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
              <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Scoring & analysis</h3>
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <Info label="Confidence score" value={reading.confidenceScore?.toString() || "N/A"} />
                <Info label="Anomaly score" value={reading.anomalyScore?.toString() || "N/A"} />
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Evidence</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    The uploaded image stays attached to the reading. Admin edits do not replace the evidence file here.
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
                <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Reading summary</h3>
                <Badge size="sm" color={readingStatusBadge(reading.status)}>
                  {reading.status}
                </Badge>
              </div>
              <div className="space-y-3">
                <Info label="Reading ID" value={reading.id} breakAll />
                <Info
                  label="Serial / Reference"
                  value={`${reading.meter.serialNumber} / ${reading.meter.meterReference || "N/A"}`}
                />
                <Info label="Reading date" value={formatDateTime(reading.readingAt)} />
                <Info label="Source" value={reading.source} />
                <Info label="Meter type" value={reading.meter.type} />
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
              <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Actors</h3>
              <div className="mt-4 space-y-3">
                <Info label="Submitted by" value={personLabel(reading.submittedBy)} />
                <Info label="Reviewed by" value={personLabel(reading.reviewedBy)} />
                <Info label="Customer" value={personLabel(reading.meter.customer)} />
                <Info label="Assigned agent" value={personLabel(reading.meter.assignedAgent)} />
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
              <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Meter details</h3>
              <div className="mt-4 space-y-3">
                <Info label="Serial" value={reading.meter.serialNumber} />
                <Info label="Reference" value={reading.meter.meterReference || "N/A"} />
                <Info label="Type" value={reading.meter.type} />
                <Info label="Status" value={reading.meter.status} />
                <Info label="City / Zone" value={`${reading.meter.city || "-"} / ${reading.meter.zone || "-"}`} />
                <Info
                  label="Address"
                  value={[reading.meter.addressLine1, reading.meter.addressLine2].filter(Boolean).join(", ") || "N/A"}
                />
                <Info label="Meter coordinates" value={formatGpsPair(reading.meter.latitude, reading.meter.longitude)} />
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
              <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">System context</h3>
              <div className="mt-4 space-y-3">
                <Info label="Source" value={reading.source} />
                <Info label="Reviewed at" value={formatDateTime(reading.reviewedAt)} />
                <Info label="Updated at" value={formatDateTime(reading.updatedAt)} />
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
              Cancel
            </Link>
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600"
            >
              Save changes
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
  phone: string;
} | null) {
  if (!person) return "N/A";
  return (
    [person.firstName, person.lastName].filter(Boolean).join(" ").trim() ||
    person.username ||
    person.email ||
    person.phone
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
