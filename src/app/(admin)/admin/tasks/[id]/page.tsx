import { Metadata } from "next";
import Link from "next/link";
import { Prisma, TaskEventType, TaskItemStatus, TaskPriority, TaskStatus } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Badge from "@/components/ui/badge/Badge";
import { getCurrentStaffFromServerAction } from "@/lib/auth/staffActionSession";
import { getTaskDetail } from "@/lib/backoffice/tasks";
import {
  addTaskAttachmentAction,
  addTaskCommentAction,
  addTaskItemAction,
  quickUpdateTaskStatusAction,
  toggleTaskItemStatusAction,
} from "./actions";

export const metadata: Metadata = {
  title: "Task Detail",
  description: "Task detail with checklist, field report and mission supervision",
};

function statusBadge(status: TaskStatus) {
  if (status === TaskStatus.DONE) return "success" as const;
  if (status === TaskStatus.BLOCKED) return "error" as const;
  if (status === TaskStatus.IN_PROGRESS) return "info" as const;
  if (status === TaskStatus.CANCELED) return "warning" as const;
  return "light" as const;
}

function priorityBadge(priority: TaskPriority) {
  if (priority === TaskPriority.CRITICAL) return "error" as const;
  if (priority === TaskPriority.HIGH) return "warning" as const;
  if (priority === TaskPriority.MEDIUM) return "info" as const;
  return "light" as const;
}

function eventBadge(type: TaskEventType) {
  if (type === TaskEventType.ASSIGNED) return "info" as const;
  if (type === TaskEventType.STARTED) return "info" as const;
  if (type === TaskEventType.BLOCKED) return "warning" as const;
  if (type === TaskEventType.COMPLETED) return "success" as const;
  if (type === TaskEventType.FIELD_RESULT_SUBMITTED) return "success" as const;
  return "light" as const;
}

function itemStatusBadge(status: TaskItemStatus) {
  if (status === TaskItemStatus.DONE) return "success" as const;
  if (status === TaskItemStatus.CANCELED) return "error" as const;
  return "light" as const;
}

function formatDate(value: Date | null) {
  if (!value) return "-";
  return value.toISOString().slice(0, 16).replace("T", " ");
}

function personLabel(
  person?:
    | {
        firstName: string | null;
        lastName: string | null;
        username?: string | null;
        phone?: string | null;
      }
    | null
) {
  if (!person) return "N/A";
  return (
    [person.firstName, person.lastName].filter(Boolean).join(" ").trim() ||
    person.username ||
    person.phone ||
    "User"
  );
}

function messageFromParams(search: Record<string, string | string[] | undefined>) {
  const error = Array.isArray(search.error) ? search.error[0] : search.error;
  if (error) return { type: "error" as const, text: error.replaceAll("_", " ") };

  const successKeys = ["created", "updated", "commented", "attachment", "item", "item_updated", "status_updated"];
  const anySuccess = successKeys.some((key) => {
    const val = search[key];
    return (Array.isArray(val) ? val[0] : val) === "1";
  });
  if (anySuccess) return { type: "success" as const, text: "Action completed successfully." };
  return null;
}

function decimalToString(value: { toString(): string } | null | undefined) {
  if (!value) return "N/A";
  return value.toString();
}

function decimalToNumber(value: { toString(): string } | null | undefined) {
  if (!value) return null;
  const num = Number(value.toString());
  return Number.isFinite(num) ? num : null;
}

function formatGps(
  latitude: { toString(): string } | null | undefined,
  longitude: { toString(): string } | null | undefined
) {
  const lat = decimalToNumber(latitude);
  const lng = decimalToNumber(longitude);
  if (lat === null || lng === null) return "N/A";
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

function resolutionLabel(value: string | null) {
  if (!value) return "N/A";
  return value.replaceAll("_", " ");
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

function formatPayloadValue(value: Prisma.JsonValue): string {
  if (value === null) return "N/A";
  if (typeof value === "string") return value;
  if (typeof value === "number") return value.toString();
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.length === 0 ? "[]" : value.map((item) => formatPayloadValue(item as Prisma.JsonValue)).join(", ");
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

function addressLabel(task: {
  meter: {
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    zone: string | null;
  } | null;
}) {
  if (!task.meter) return "N/A";
  const parts = [
    task.meter.addressLine1,
    task.meter.addressLine2,
    task.meter.city,
    task.meter.zone,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "N/A";
}

export default async function TaskDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const staff = await getCurrentStaffFromServerAction();
  if (!staff) redirect("/signin");

  const { id } = await params;
  const resolvedSearchParams = await searchParams;

  const detail = await getTaskDetail({ id: staff.id, role: staff.role }, id);
  if (detail.status === 404) notFound();
  if (detail.status !== 200) {
    redirect(`/admin/tasks?error=${detail.body.error || "task_load_failed"}`);
  }

  const task = detail.body.task;
  if (!task) notFound();

  const addComment = addTaskCommentAction.bind(null, task.id);
  const addAttachment = addTaskAttachmentAction.bind(null, task.id);
  const addItem = addTaskItemAction.bind(null, task.id);
  const infoMessage = messageFromParams(resolvedSearchParams);

  return (
    <div>
      <PageBreadcrumb pageTitle="Task detail" />

      {infoMessage ? (
        <div
          className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
            infoMessage.type === "error"
              ? "border-error-200 bg-error-50 text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300"
              : "border-success-200 bg-success-50 text-success-700 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-300"
          }`}
        >
          {infoMessage.text}
        </div>
      ) : null}

      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white/90">{task.title}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">{task.description || "No description"}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge size="sm" color={statusBadge(task.status)}>{task.status}</Badge>
          <Link
            href={`/admin/tasks/${task.id}/edit`}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]"
          >
            Edit
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className="space-y-6 xl:col-span-2">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Quick status actions</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {[TaskStatus.OPEN, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED, TaskStatus.DONE].map((status) => {
                const action = quickUpdateTaskStatusAction.bind(null, task.id, status);
                return (
                  <form key={status} action={action}>
                    <button
                      type="submit"
                      className="inline-flex h-9 items-center rounded-md border border-gray-300 px-3 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]"
                    >
                      {status}
                    </button>
                  </form>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Field report</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Everything the agent submitted from the field.
                </p>
              </div>
              {task.fieldSubmittedAt ? (
                <Badge size="sm" color="success">SUBMITTED</Badge>
              ) : (
                <Badge size="sm" color="light">AWAITING REPORT</Badge>
              )}
            </div>

            {task.fieldSubmittedAt ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <Info label="Submitted at" value={formatDate(task.fieldSubmittedAt)} />
                  <Info label="Outcome" value={resolutionLabel(task.resolutionCode)} />
                  <Info label="Started at" value={formatDate(task.startedAt)} />
                  <Info label="Field primary index" value={decimalToString(task.fieldPrimaryIndex)} />
                  <Info label="Field secondary index" value={decimalToString(task.fieldSecondaryIndex)} />
                  <Info label="GPS accuracy (m)" value={decimalToString(task.fieldGpsAccuracyMeters)} />
                  <Info label="Field coordinates" value={formatGps(task.fieldGpsLatitude, task.fieldGpsLongitude)} />
                  <Info label="Image mime" value={task.fieldImageMimeType || "N/A"} />
                  <Info
                    label="Image size bytes"
                    value={task.fieldImageSizeBytes ? String(task.fieldImageSizeBytes) : "N/A"}
                  />
                </div>

                {task.resolutionComment ? (
                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-white/[0.02]">
                    <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Agent comment
                    </p>
                    <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{task.resolutionComment}</p>
                  </div>
                ) : null}

                {task.fieldImageUrl ? (
                  <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
                    <img
                      src={`/api/v1/tasks/${task.id}/field-image`}
                      alt={`Task ${task.id} field report`}
                      className="h-auto w-full object-cover"
                    />
                  </div>
                ) : null}

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <LinkedReadingCard
                    title="Source reading"
                    reading={task.reading}
                    href={task.reading ? `/admin/readings/${task.reading.id}` : null}
                  />
                  <LinkedReadingCard
                    title="Reported reading"
                    reading={task.reportedReading}
                    href={task.reportedReading ? `/admin/readings/${task.reportedReading.id}` : null}
                  />
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                No field report has been submitted yet.
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Checklist</h3>
              <span className="text-xs text-gray-500 dark:text-gray-400">{task.items.length} items</span>
            </div>

            <div className="space-y-3">
              {task.items.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No checklist item.</p>
              ) : (
                task.items.map((item) => {
                  const nextStatus = item.status === TaskItemStatus.DONE ? TaskItemStatus.TODO : TaskItemStatus.DONE;
                  const toggleAction = toggleTaskItemStatusAction.bind(null, task.id, item.id, nextStatus);
                  return (
                    <div key={item.id} className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-gray-800 dark:text-white/90">{item.title}</p>
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{item.details || "No details"}</p>
                        </div>
                        <Badge size="sm" color={itemStatusBadge(item.status)}>{item.status}</Badge>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <form action={toggleAction}>
                          <button
                            type="submit"
                            className="inline-flex h-8 items-center rounded-md border border-gray-300 px-3 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]"
                          >
                            Mark as {nextStatus}
                          </button>
                        </form>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <form action={addItem} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-12">
              <input
                name="title"
                placeholder="Checklist item title"
                className="h-11 rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 md:col-span-5"
                required
              />
              <input
                name="details"
                placeholder="Details"
                className="h-11 rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 md:col-span-5"
              />
              <input
                name="sortOrder"
                type="number"
                defaultValue={0}
                className="h-11 rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 md:col-span-1"
              />
              <button type="submit" className="h-11 rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600 md:col-span-1">
                Add
              </button>
            </form>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Comments</h3>
            <div className="mt-3 space-y-3">
              {task.comments.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No comment yet.</p>
              ) : (
                task.comments.map((comment) => (
                  <div key={comment.id} className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-800 dark:text-white/90">{personLabel(comment.user)}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(comment.createdAt)}</p>
                    </div>
                    <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{comment.comment}</p>
                  </div>
                ))
              )}
            </div>

            <form action={addComment} className="mt-4 space-y-3">
              <textarea
                name="comment"
                rows={3}
                placeholder="Write a comment"
                className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                required
              />
              <label className="inline-flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <input type="checkbox" name="isInternal" value="1" defaultChecked className="h-3.5 w-3.5" />
                Internal comment
              </label>
              <button type="submit" className="inline-flex h-10 items-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600">
                Add comment
              </button>
            </form>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Attachments</h3>
            <div className="mt-3 space-y-2">
              {task.attachments.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No attachment.</p>
              ) : (
                task.attachments.map((attachment) => (
                  <a
                    key={attachment.id}
                    href={attachment.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-lg border border-gray-200 p-3 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
                  >
                    <p className="font-medium">{attachment.fileName}</p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{formatDate(attachment.createdAt)}</p>
                  </a>
                ))
              )}
            </div>

            <form action={addAttachment} className="mt-4 space-y-2">
              <input
                name="fileUrl"
                placeholder="https://..."
                className="h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                required
              />
              <input
                name="fileName"
                placeholder="file name"
                className="h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                required
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  name="mimeType"
                  placeholder="mime type"
                  className="h-10 rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                />
                <input
                  name="fileSizeBytes"
                  type="number"
                  placeholder="size bytes"
                  className="h-10 rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                />
              </div>
              <input
                name="fileHash"
                placeholder="file hash (optional)"
                className="h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
              />
              <button type="submit" className="inline-flex h-10 items-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600">
                Add attachment
              </button>
            </form>
          </div>
        </section>

        <aside className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Mission overview</h3>
            <div className="mt-4 grid grid-cols-1 gap-3">
              <Info label="Task ID" value={task.id.slice(0, 8)} />
              <Info label="Type" value={task.type} />
              <Info label="Status" value={task.status} />
              <Info label="Priority" value={task.priority} />
              <Info label="Outcome" value={resolutionLabel(task.resolutionCode)} />
              <Info label="Assigned to" value={personLabel(task.assignedTo)} />
              <Info label="Started by" value={personLabel(task.startedBy)} />
              <Info label="Created by" value={personLabel(task.createdBy)} />
              <Info label="Closed by" value={personLabel(task.closedBy)} />
              <Info label="Created at" value={formatDate(task.createdAt)} />
              <Info label="Due at" value={formatDate(task.dueAt)} />
              <Info label="Closed at" value={formatDate(task.closedAt)} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge size="sm" color={statusBadge(task.status)}>{task.status}</Badge>
              <Badge size="sm" color={priorityBadge(task.priority)}>{task.priority}</Badge>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Context</h3>
            <div className="mt-4 grid grid-cols-1 gap-3">
              <Info label="Customer" value={personLabel(task.meter?.customer)} />
              <Info label="Meter serial" value={task.meter?.serialNumber || "N/A"} />
              <Info label="Meter reference" value={task.meter?.meterReference || "N/A"} />
              <Info label="Meter type" value={task.meter?.type || "N/A"} />
              <Info label="Address / zone" value={addressLabel(task)} />
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Mission events</h3>
              <span className="text-xs text-gray-500 dark:text-gray-400">{task.events.length}</span>
            </div>
            {task.events.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No mission event found.</p>
            ) : (
              <div className="space-y-3">
                {task.events.map((event) => {
                  const payloadEntries = flattenPayload(event.payload as Prisma.JsonValue);
                  return (
                    <div key={event.id} className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Badge size="sm" color={eventBadge(event.type)}>{event.type}</Badge>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(event.createdAt)}</p>
                      </div>
                      <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                        By: {personLabel(event.actorUser)}
                      </p>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Recipient: {personLabel(event.recipientUser)}
                      </p>

                      {payloadEntries.length > 0 ? (
                        <div className="mt-3 grid grid-cols-1 gap-2">
                          {payloadEntries.map((item) => (
                            <div
                              key={`${event.id}-${item.key}`}
                              className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-white/[0.03]"
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
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Timeline</h3>
            <div className="mt-3 space-y-2">
              {task.timeline.map((event) => (
                <div key={event.id} className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                  <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{event.type}</p>
                  <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{event.label}</p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{formatDate(event.at)}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-white/[0.02]">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 break-words text-sm font-medium text-gray-800 dark:text-white/90">{value}</p>
    </div>
  );
}

function LinkedReadingCard({
  title,
  reading,
  href,
}: {
  title: string;
  reading:
    | {
        id: string;
        status: string;
        readingAt: Date;
        primaryIndex: { toString(): string };
        secondaryIndex: { toString(): string } | null;
      }
    | null;
  href: string | null;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-white/[0.02]">
      <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{title}</p>
      {!reading ? (
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">No linked reading.</p>
      ) : (
        <div className="mt-2 space-y-2">
          <p className="text-sm font-medium text-gray-800 dark:text-white/90">{reading.id.slice(0, 8)}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Status: {reading.status}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Reading at: {formatDate(reading.readingAt)}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Index: {reading.primaryIndex.toString()}
            {reading.secondaryIndex ? ` | ${reading.secondaryIndex.toString()}` : ""}
          </p>
          {href ? (
            <Link href={href} className="inline-flex text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">
              Open reading detail
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}
