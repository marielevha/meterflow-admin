import { Metadata } from "next";
import Link from "next/link";
import { ReadingStatus } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import { getCurrentStaffFromServerAction } from "@/lib/auth/staffActionSession";
import { prisma } from "@/lib/prisma";
import {
  FLAG_REASON_OPTIONS,
  REJECTION_REASON_OPTIONS,
  getReviewReasonLabel,
} from "@/lib/readings/reviewReasons";
import { updateReadingAction } from "./actions";

export const metadata: Metadata = {
  title: "Edit reading",
  description: "Edit meter reading",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function toDatetimeLocal(value: Date | null) {
  if (!value) return "";
  return value.toISOString().slice(0, 16);
}

function decimalToInput(value: { toString(): string } | null) {
  return value ? value.toString() : "";
}

function mapError(code: string) {
  if (!code) return "";
  if (code === "invalid_status") return "Invalid status selected.";
  if (code === "invalid_reading_date") return "Reading date is invalid.";
  if (code === "invalid_primary_index") return "Primary index is invalid.";
  if (code === "invalid_secondary_index") return "Secondary index is invalid.";
  if (code === "image_url_required") return "Image URL is required.";
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
          customer: {
            select: {
              firstName: true,
              lastName: true,
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

  return (
    <div>
      <PageBreadcrumb pageTitle="Edit reading" />

      <form action={submit} className="space-y-6">
        {error ? (
          <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300">
            {error}
          </div>
        ) : null}

        <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Reading metadata</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {reading.meter.serialNumber} / {reading.meter.meterReference || "N/A"}
              </p>
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Submitted by: {personLabel(reading.submittedBy)}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div>
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                name="status"
                defaultValue={reading.status}
                className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
              >
                {Object.values(ReadingStatus).map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="readingAt">Reading date</Label>
              <Input
                id="readingAt"
                name="readingAt"
                type="datetime-local"
                defaultValue={toDatetimeLocal(reading.readingAt)}
                required
              />
            </div>

            <div>
              <Label htmlFor="primaryIndex">Primary index</Label>
              <Input
                id="primaryIndex"
                name="primaryIndex"
                type="number"
                step="0.001"
                min="0"
                defaultValue={decimalToInput(reading.primaryIndex)}
                required
              />
            </div>

            <div>
              <Label htmlFor="secondaryIndex">Secondary index</Label>
              <Input
                id="secondaryIndex"
                name="secondaryIndex"
                type="number"
                step="0.001"
                min="0"
                defaultValue={decimalToInput(reading.secondaryIndex)}
              />
            </div>

            <div>
              <Label htmlFor="confidenceScore">Confidence score</Label>
              <Input
                id="confidenceScore"
                name="confidenceScore"
                type="number"
                step="0.01"
                min="0"
                defaultValue={decimalToInput(reading.confidenceScore)}
              />
            </div>

            <div>
              <Label htmlFor="anomalyScore">Anomaly score</Label>
              <Input
                id="anomalyScore"
                name="anomalyScore"
                type="number"
                step="0.001"
                min="0"
                defaultValue={decimalToInput(reading.anomalyScore)}
              />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Evidence & location</h3>
          <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
            <img
              src={`/api/v1/readings/${reading.id}/image`}
              alt={`Reading ${reading.id}`}
              className="h-auto max-h-[380px] w-full object-cover"
            />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="md:col-span-2 xl:col-span-3">
              <Label htmlFor="imageUrl">Image URL</Label>
              <Input id="imageUrl" name="imageUrl" defaultValue={reading.imageUrl} required />
            </div>

            <div>
              <Label htmlFor="gpsLatitude">GPS latitude</Label>
              <Input
                id="gpsLatitude"
                name="gpsLatitude"
                type="number"
                step="0.0000001"
                defaultValue={decimalToInput(reading.gpsLatitude)}
              />
            </div>
            <div>
              <Label htmlFor="gpsLongitude">GPS longitude</Label>
              <Input
                id="gpsLongitude"
                name="gpsLongitude"
                type="number"
                step="0.0000001"
                defaultValue={decimalToInput(reading.gpsLongitude)}
              />
            </div>
            <div>
              <Label htmlFor="gpsAccuracyMeters">GPS accuracy (m)</Label>
              <Input
                id="gpsAccuracyMeters"
                name="gpsAccuracyMeters"
                type="number"
                step="0.01"
                min="0"
                defaultValue={decimalToInput(reading.gpsAccuracyMeters)}
              />
            </div>
            <div>
              <Label htmlFor="gpsDistanceMeters">GPS distance (m)</Label>
              <Input
                id="gpsDistanceMeters"
                name="gpsDistanceMeters"
                type="number"
                step="0.01"
                min="0"
                defaultValue={decimalToInput(reading.gpsDistanceMeters)}
              />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Decision reasons</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            When status is <span className="font-medium text-gray-700 dark:text-gray-200">Flagged</span> or{" "}
            <span className="font-medium text-gray-700 dark:text-gray-200">Rejected</span>, selecting a normalized
            reason is mandatory.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="flagReason">Flag reason</Label>
              <select
                id="flagReason"
                name="flagReason"
                defaultValue={reading.flagReason || ""}
                className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
              >
                <option value="">Select a flag reason</option>
                {FLAG_REASON_OPTIONS.map((reason) => (
                  <option key={reason.code} value={reason.code}>
                    {reason.label}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Current value: {getReviewReasonLabel(reading.flagReason) || "N/A"}
              </p>
            </div>
            <div>
              <Label htmlFor="rejectionReason">Rejection reason</Label>
              <select
                id="rejectionReason"
                name="rejectionReason"
                defaultValue={reading.rejectionReason || ""}
                className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
              >
                <option value="">Select a rejection reason</option>
                {REJECTION_REASON_OPTIONS.map((reason) => (
                  <option key={reason.code} value={reason.code}>
                    {reason.label}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Current value: {getReviewReasonLabel(reading.rejectionReason) || "N/A"}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Context (read only)</h3>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Readonly label="Meter type" value={reading.meter.type} />
            <Readonly label="Customer" value={personLabel(reading.meter.customer)} />
            <Readonly label="Submitted by" value={personLabel(reading.submittedBy)} />
            <Readonly label="Reviewed by" value={personLabel(reading.reviewedBy)} />
            <Readonly label="Reviewed at" value={reading.reviewedAt ? reading.reviewedAt.toISOString().slice(0, 19).replace("T", " ") : "N/A"} />
            <Readonly label="Updated at" value={reading.updatedAt.toISOString().slice(0, 19).replace("T", " ")} />
          </div>
        </section>

        <div className="sticky bottom-4 z-30 rounded-xl border border-gray-200 bg-white/90 p-4 backdrop-blur dark:border-gray-800 dark:bg-gray-900/90">
          <div className="flex items-center justify-end gap-2">
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

function Readonly({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-white/[0.02] dark:text-gray-200">
        {value}
      </p>
    </div>
  );
}
