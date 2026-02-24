import { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Prisma } from "@prisma/client";
import { ReadingEventType, ReadingStatus, UserRole } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Badge from "@/components/ui/badge/Badge";
import { getCurrentStaffFromServerAction } from "@/lib/auth/staffActionSession";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Reading details | MeterFlow Dashboard",
  description: "Reading details and audit trail",
};

function formatDate(value: Date | null) {
  if (!value) return "N/A";
  return value.toISOString().slice(0, 19).replace("T", " ");
}

function decimalToString(value: { toString(): string } | null) {
  if (!value) return "N/A";
  return value.toString();
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
  if (!person) return "N/A";
  return (
    [person.firstName, person.lastName].filter(Boolean).join(" ").trim() ||
    person.username ||
    person.email ||
    person.phone
  );
}

function canEdit(role: UserRole) {
  return role === UserRole.ADMIN || role === UserRole.SUPERVISOR || role === UserRole.AGENT;
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

function formatPayloadValue(value: Prisma.JsonValue): string {
  if (value === null) return "N/A";
  if (typeof value === "string") {
    if (isIsoDateString(value)) {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) return formatDate(date);
    }
    return value;
  }
  if (typeof value === "number") return value.toString();
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return value.map((item) => formatPayloadValue(item as Prisma.JsonValue)).join(", ");
  }
  return "Object";
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
  const staff = await getCurrentStaffFromServerAction();
  if (!staff) redirect("/signin");

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
        where: { deletedAt: null },
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
    },
  });

  if (!reading) notFound();

  return (
    <div>
      <PageBreadcrumb pageTitle="Reading details" />

      <div className="mb-6 flex flex-wrap items-center justify-end gap-2">
        <Link
          href="/admin/readings"
          className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]"
        >
          Back
        </Link>
        {canEdit(staff.role) ? (
          <Link
            href={`/admin/readings/${reading.id}/edit`}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600"
          >
            Edit reading
          </Link>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className="xl:col-span-2 space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Reading ID</p>
                <p className="mt-1 break-all text-sm text-gray-800 dark:text-white/90">{reading.id}</p>
              </div>
              <Badge size="sm" color={readingStatusBadge(reading.status)}>
                {reading.status}
              </Badge>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <Info label="Source" value={reading.source} />
              <Info label="Reading at" value={formatDate(reading.readingAt)} />
              <Info label="Reviewed at" value={formatDate(reading.reviewedAt)} />
              <Info label="Primary index" value={decimalToString(reading.primaryIndex)} />
              <Info label="Secondary index" value={decimalToString(reading.secondaryIndex)} />
              <Info label="Confidence score" value={decimalToString(reading.confidenceScore)} />
              <Info label="Anomaly score" value={decimalToString(reading.anomalyScore)} />
              <Info label="GPS accuracy (m)" value={decimalToString(reading.gpsAccuracyMeters)} />
              <Info label="GPS distance (m)" value={decimalToString(reading.gpsDistanceMeters)} />
            </div>

            {(reading.flagReason || reading.rejectionReason) ? (
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <Info label="Flag reason" value={reading.flagReason || "N/A"} />
                <Info label="Rejection reason" value={reading.rejectionReason || "N/A"} />
              </div>
            ) : null}

            {reading.ocrText ? (
              <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-white/[0.02]">
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">OCR text</p>
                <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{reading.ocrText}</p>
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Evidence</h3>
            <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
              <Image
                src={reading.imageUrl}
                alt={`Reading ${reading.id}`}
                width={1280}
                height={960}
                unoptimized
                className="h-auto w-full object-cover"
              />
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Info label="Image URL" value={reading.imageUrl} breakAll />
              <Info label="Image hash" value={reading.imageHash || "N/A"} />
              <Info label="Image mime" value={reading.imageMimeType || "N/A"} />
              <Info
                label="Image size bytes"
                value={reading.imageSizeBytes ? String(reading.imageSizeBytes) : "N/A"}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Reading events audit trail</h3>
            <div className="mt-4 space-y-3">
              {reading.events.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No event found.</p>
              ) : (
                reading.events.map((event) => {
                  const payloadEntries = flattenPayload(event.payload as Prisma.JsonValue);
                  return (
                    <div key={event.id} className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Badge size="sm" color={eventBadge(event.type)}>
                          {event.type}
                        </Badge>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(event.createdAt)}</p>
                      </div>
                      <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                        By: {personLabel(event.user)}
                      </p>
                      <div className="mt-3 rounded-lg border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-white/[0.02]">
                        {payloadEntries.length === 0 ? (
                          <p className="text-xs text-gray-500 dark:text-gray-400">No additional details.</p>
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
                                  {formatPayloadValue(item.value)}
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
        </section>

        <aside className="space-y-6">
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
                label="Meter coordinates"
                value={`${decimalToString(reading.meter.latitude)} / ${decimalToString(reading.meter.longitude)}`}
              />
              <Info
                label="Reading coordinates"
                value={`${decimalToString(reading.gpsLatitude)} / ${decimalToString(reading.gpsLongitude)}`}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Linked tasks</h3>
              <span className="text-xs text-gray-500 dark:text-gray-400">{reading.tasks.length}</span>
            </div>
            {reading.tasks.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No task linked to this reading.</p>
            ) : (
              <div className="space-y-2">
                {reading.tasks.map((task) => (
                  <Link
                    key={task.id}
                    href={`/admin/tasks/${task.id}`}
                    className="block rounded-lg border border-gray-200 p-3 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-white/[0.03]"
                  >
                    <p className="text-sm font-medium text-gray-800 dark:text-white/90">{task.title}</p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {task.status} - {task.priority} - {formatDate(task.createdAt)}
                    </p>
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
