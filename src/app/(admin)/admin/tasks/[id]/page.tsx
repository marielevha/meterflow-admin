import { Metadata } from "next";
import Link from "next/link";
import { Prisma, ReadingStatus, TaskEventType, TaskItemStatus, TaskPriority, TaskStatus } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Badge from "@/components/ui/badge/Badge";
import {
  ADMIN_PERMISSION_GROUPS,
  hasAnyPermissionCode,
  requireAdminPermissions,
} from "@/lib/auth/adminPermissions";
import {
  translateMeterType,
  translateReadingStatus,
  translateTaskEventType,
  translateTaskItemStatus,
  translateTaskPriority,
  translateTaskResolutionCode,
  translateTaskStatus,
  translateTaskType,
} from "@/lib/admin-i18n/labels";
import { getAdminTranslator } from "@/lib/admin-i18n/server";
import { getCurrentStaffPermissionCodes } from "@/lib/auth/staffServerSession";
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

function formatDate(value: Date | null, fallback: string) {
  if (!value) return fallback;
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
  if (!person) return null;
  return (
    [person.firstName, person.lastName].filter(Boolean).join(" ").trim() ||
    person.username ||
    person.phone ||
    null
  );
}

function messageFromParams(search: Record<string, string | string[] | undefined>) {
  const error = Array.isArray(search.error) ? search.error[0] : search.error;
  if (error) return { type: "error" as const, text: error };

  const successKeys = ["created", "updated", "commented", "attachment", "item", "item_updated", "status_updated"];
  const anySuccess = successKeys.some((key) => {
    const val = search[key];
    return (Array.isArray(val) ? val[0] : val) === "1";
  });
  if (anySuccess) return { type: "success" as const, text: "task_action_completed" };
  return null;
}

function mapTaskMessage(code: string, t: (key: string) => string) {
  if (!code) return "";
  if (code === "invalid_status") return t("tasks.errorInvalidStatus");
  if (code === "invalid_status_transition") return t("tasks.errorInvalidStatusTransition");
  if (code === "invalid_priority") return t("tasks.errorInvalidPriority");
  if (code === "invalid_type") return t("tasks.errorInvalidType");
  if (code === "invalid_due_at") return t("tasks.errorInvalidDueAt");
  if (code === "invalid_sort_order") return t("tasks.errorInvalidSortOrder");
  if (code === "invalid_item_status") return t("tasks.errorInvalidItemStatus");
  if (code === "task_load_failed") return t("tasks.errorTaskLoadFailed");
  if (code === "update_failed") return t("tasks.errorUpdateFailed");
  return code.replaceAll("_", " ");
}

function decimalToString(value: { toString(): string } | null | undefined) {
  if (!value) return null;
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
  if (lat === null || lng === null) return null;
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
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

function formatPayloadValue(value: Prisma.JsonValue, t: (key: string) => string): string {
  if (value === null) return t("common.notAvailable");
  if (typeof value === "string") return value;
  if (typeof value === "number") return value.toString();
  if (typeof value === "boolean") return value ? t("common.yes") : t("common.no");
  if (Array.isArray(value)) return value.length === 0 ? "[]" : value.map((item) => formatPayloadValue(item as Prisma.JsonValue, t)).join(", ");
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

function addressLabel(task: {
  meter: {
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    zone: string | null;
  } | null;
}) {
  if (!task.meter) return null;
  const parts = [
    task.meter.addressLine1,
    task.meter.addressLine2,
    task.meter.city,
    task.meter.zone,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

export default async function TaskDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { t } = await getAdminTranslator();
  const staff = await requireAdminPermissions("/admin/tasks", ADMIN_PERMISSION_GROUPS.tasksView);
  const permissionCodes = await getCurrentStaffPermissionCodes(staff.id);
  const canEditTask = hasAnyPermissionCode(permissionCodes, ADMIN_PERMISSION_GROUPS.tasksEditPage);
  const canUpdateTaskStatus = hasAnyPermissionCode(permissionCodes, ADMIN_PERMISSION_GROUPS.tasksUpdate);
  const canCommentOnTasks = hasAnyPermissionCode(permissionCodes, ADMIN_PERMISSION_GROUPS.tasksComment);
  const canManageTaskAttachments = hasAnyPermissionCode(
    permissionCodes,
    ADMIN_PERMISSION_GROUPS.tasksAttachmentManage
  );
  const canManageTaskItems = hasAnyPermissionCode(
    permissionCodes,
    ADMIN_PERMISSION_GROUPS.tasksItemManage
  );

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
  const feedbackText =
    infoMessage?.type === "success"
      ? infoMessage.text === "task_action_completed"
        ? t("tasks.eventCompleted")
        : infoMessage.text
      : mapTaskMessage(infoMessage?.text ?? "", t);

  return (
    <div>
      <PageBreadcrumb pageTitle={t("tasks.detailPageTitle")} />

      {infoMessage ? (
        <div
          className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
            infoMessage.type === "error"
              ? "border-error-200 bg-error-50 text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300"
              : "border-success-200 bg-success-50 text-success-700 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-300"
          }`}
        >
          {feedbackText}
        </div>
      ) : null}

      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white/90">{task.title}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">{task.description || t("common.noDescription")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge size="sm" color={statusBadge(task.status)}>{translateTaskStatus(task.status, t)}</Badge>
          {canEditTask ? (
            <Link
              href={`/admin/tasks/${task.id}/edit`}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]"
            >
              {t("common.edit")}
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className="space-y-6 xl:col-span-2">
          {canUpdateTaskStatus ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
              <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">{t("tasks.quickStatusActions")}</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {[TaskStatus.OPEN, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED, TaskStatus.DONE].map((status) => {
                  const action = quickUpdateTaskStatusAction.bind(null, task.id, status);
                  return (
                    <form key={status} action={action}>
                      <button
                        type="submit"
                        className="inline-flex h-9 items-center rounded-md border border-gray-300 px-3 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]"
                      >
                        {translateTaskStatus(status, t)}
                      </button>
                    </form>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">{t("tasks.fieldReportTitle")}</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {t("tasks.fieldReportDesc")}
                </p>
              </div>
              {task.fieldSubmittedAt ? (
                <Badge size="sm" color="success">{t("tasks.fieldReportSubmitted")}</Badge>
              ) : (
                <Badge size="sm" color="light">{t("tasks.fieldReportAwaiting")}</Badge>
              )}
            </div>

            {task.fieldSubmittedAt ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <Info label={t("tasks.submittedAt")} value={formatDate(task.fieldSubmittedAt, t("common.notAvailable"))} />
                  <Info label={t("tasks.outcome")} value={translateTaskResolutionCode(task.resolutionCode, t)} />
                  <Info label={t("tasks.startedAt")} value={formatDate(task.startedAt, t("common.notAvailable"))} />
                  <Info label={t("tasks.fieldPrimaryIndex")} value={decimalToString(task.fieldPrimaryIndex) || t("common.notAvailable")} />
                  <Info label={t("tasks.fieldSecondaryIndex")} value={decimalToString(task.fieldSecondaryIndex) || t("common.notAvailable")} />
                  <Info label={t("tasks.gpsAccuracyMeters")} value={decimalToString(task.fieldGpsAccuracyMeters) || t("common.notAvailable")} />
                  <Info label={t("tasks.fieldCoordinates")} value={formatGps(task.fieldGpsLatitude, task.fieldGpsLongitude) || t("common.notAvailable")} />
                  <Info label={t("tasks.imageMime")} value={task.fieldImageMimeType || t("common.notAvailable")} />
                  <Info
                    label={t("tasks.imageSizeBytes")}
                    value={task.fieldImageSizeBytes ? String(task.fieldImageSizeBytes) : t("common.notAvailable")}
                  />
                </div>

                {task.resolutionComment ? (
                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-white/[0.02]">
                    <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      {t("tasks.agentComment")}
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
                    title={t("tasks.sourceReadingTitle")}
                    reading={task.reading}
                    href={task.reading ? `/admin/readings/${task.reading.id}` : null}
                    t={t}
                  />
                  <LinkedReadingCard
                    title={t("tasks.reportedReadingTitle")}
                    reading={task.reportedReading}
                    href={task.reportedReading ? `/admin/readings/${task.reportedReading.id}` : null}
                    t={t}
                  />
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                {t("tasks.noFieldReportSubmitted")}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">{t("tasks.checklist")}</h3>
              <span className="text-xs text-gray-500 dark:text-gray-400">{t("tasks.checklistItems", { count: task.items.length })}</span>
            </div>

            <div className="space-y-3">
              {task.items.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">{t("tasks.noChecklistItem")}</p>
              ) : (
                task.items.map((item) => {
                  const nextStatus = item.status === TaskItemStatus.DONE ? TaskItemStatus.TODO : TaskItemStatus.DONE;
                  const toggleAction = toggleTaskItemStatusAction.bind(null, task.id, item.id, nextStatus);
                  return (
                    <div key={item.id} className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-gray-800 dark:text-white/90">{item.title}</p>
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{item.details || t("tasks.noDetails")}</p>
                        </div>
                        <Badge size="sm" color={itemStatusBadge(item.status)}>{translateTaskItemStatus(item.status, t)}</Badge>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        {canManageTaskItems ? (
                          <form action={toggleAction}>
                            <button
                              type="submit"
                              className="inline-flex h-8 items-center rounded-md border border-gray-300 px-3 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]"
                            >
                              {t("tasks.markAs", { status: translateTaskItemStatus(nextStatus, t) })}
                            </button>
                          </form>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {canManageTaskItems ? (
              <form action={addItem} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-12">
                <input
                  name="title"
                  placeholder={t("tasks.checklistTitlePlaceholder")}
                  className="h-11 rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 md:col-span-5"
                  required
                />
                <input
                  name="details"
                  placeholder={t("tasks.checklistDetailsPlaceholder")}
                  className="h-11 rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 md:col-span-5"
                />
                <input
                  name="sortOrder"
                  type="number"
                  defaultValue={0}
                  className="h-11 rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 md:col-span-1"
                />
                <button type="submit" className="h-11 rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600 md:col-span-1">
                  {t("tasks.addItem")}
                </button>
              </form>
            ) : null}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">{t("tasks.comments")}</h3>
            <div className="mt-3 space-y-3">
              {task.comments.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">{t("tasks.noCommentYet")}</p>
              ) : (
                task.comments.map((comment) => (
                  <div key={comment.id} className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-800 dark:text-white/90">{personLabel(comment.user) || t("common.unknown")}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(comment.createdAt, t("common.notAvailable"))}</p>
                    </div>
                    <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{comment.comment}</p>
                  </div>
                ))
              )}
            </div>

            {canCommentOnTasks ? (
              <form action={addComment} className="mt-4 space-y-3">
                <textarea
                  name="comment"
                  rows={3}
                  placeholder={t("tasks.writeComment")}
                  className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                  required
                />
                <label className="inline-flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <input type="checkbox" name="isInternal" value="1" defaultChecked className="h-3.5 w-3.5" />
                  {t("tasks.internalComment")}
                </label>
                <button type="submit" className="inline-flex h-10 items-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600">
                  {t("tasks.addComment")}
                </button>
              </form>
            ) : null}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">{t("tasks.attachments")}</h3>
            <div className="mt-3 space-y-2">
              {task.attachments.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">{t("tasks.noAttachment")}</p>
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
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{formatDate(attachment.createdAt, t("common.notAvailable"))}</p>
                  </a>
                ))
              )}
            </div>

            {canManageTaskAttachments ? (
              <form action={addAttachment} className="mt-4 space-y-2">
                <input
                  name="fileUrl"
                  placeholder={t("tasks.fileUrlPlaceholder")}
                  className="h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                  required
                />
                <input
                  name="fileName"
                  placeholder={t("tasks.fileNamePlaceholder")}
                  className="h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                  required
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    name="mimeType"
                    placeholder={t("tasks.mimeTypePlaceholder")}
                    className="h-10 rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                  />
                  <input
                    name="fileSizeBytes"
                    type="number"
                    placeholder={t("tasks.fileSizeBytesPlaceholder")}
                    className="h-10 rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                  />
                </div>
                <input
                  name="fileHash"
                  placeholder={t("tasks.fileHashPlaceholder")}
                  className="h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                />
                <button type="submit" className="inline-flex h-10 items-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600">
                  {t("tasks.addAttachment")}
                </button>
              </form>
            ) : null}
          </div>
        </section>

        <aside className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">{t("tasks.missionOverview")}</h3>
            <div className="mt-4 grid grid-cols-1 gap-3">
              <Info label={t("tasks.taskId")} value={task.id.slice(0, 8)} />
              <Info label={t("common.type")} value={translateTaskType(task.type, t)} />
              <Info label={t("tasks.statusLabel")} value={translateTaskStatus(task.status, t)} />
              <Info label={t("common.priority")} value={translateTaskPriority(task.priority, t)} />
              <Info label={t("tasks.outcome")} value={translateTaskResolutionCode(task.resolutionCode, t)} />
              <Info label={t("tasks.tableAssignee")} value={personLabel(task.assignedTo) || t("tasks.unassigned")} />
              <Info label={t("tasks.startedBy")} value={personLabel(task.startedBy) || t("common.notAvailable")} />
              <Info label={t("tasks.createdBy")} value={personLabel(task.createdBy) || t("common.notAvailable")} />
              <Info label={t("tasks.closedBy")} value={personLabel(task.closedBy) || t("common.notAvailable")} />
              <Info label={t("meters.createdAt")} value={formatDate(task.createdAt, t("common.notAvailable"))} />
              <Info label={t("tasks.dueAt")} value={formatDate(task.dueAt, "-")} />
              <Info label={t("tasks.closedAt")} value={formatDate(task.closedAt, "-")} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge size="sm" color={statusBadge(task.status)}>{translateTaskStatus(task.status, t)}</Badge>
              <Badge size="sm" color={priorityBadge(task.priority)}>{translateTaskPriority(task.priority, t)}</Badge>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">{t("tasks.context")}</h3>
            <div className="mt-4 grid grid-cols-1 gap-3">
              <Info label={t("common.customer")} value={personLabel(task.meter?.customer) || t("common.notAvailable")} />
              <Info label={t("tasks.meterSerial")} value={task.meter?.serialNumber || t("common.notAvailable")} />
              <Info label={t("tasks.meterReference")} value={task.meter?.meterReference || t("common.notAvailable")} />
              <Info label={t("tasks.meterTypeLabel")} value={task.meter?.type ? translateMeterType(task.meter.type, t) : t("common.notAvailable")} />
              <Info label={t("tasks.addressZone")} value={addressLabel(task) || t("common.notAvailable")} />
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">{t("tasks.missionEvents")}</h3>
              <span className="text-xs text-gray-500 dark:text-gray-400">{task.events.length}</span>
            </div>
            {task.events.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">{t("tasks.noMissionEventFound")}</p>
            ) : (
              <div className="space-y-3">
                {task.events.map((event) => {
                  const payloadEntries = flattenPayload(event.payload as Prisma.JsonValue);
                  return (
                    <div key={event.id} className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Badge size="sm" color={eventBadge(event.type)}>{translateTaskEventType(event.type, t)}</Badge>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(event.createdAt, t("common.notAvailable"))}</p>
                      </div>
                      <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                        {t("readings.byUser", { user: personLabel(event.actorUser) || t("common.unknown") })}
                      </p>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {t("tasks.recipient")}: {personLabel(event.recipientUser) || t("common.notAvailable")}
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
                                {formatPayloadValue(item.value, t)}
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
            <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">{t("tasks.timeline")}</h3>
            <div className="mt-3 space-y-2">
              {task.timeline.map((event) => (
                <div key={event.id} className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                  <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{event.type}</p>
                  <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{event.label}</p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{formatDate(event.at, t("common.notAvailable"))}</p>
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
  t,
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
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-white/[0.02]">
      <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{title}</p>
      {!reading ? (
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{t("tasks.noLinkedReading")}</p>
      ) : (
        <div className="mt-2 space-y-2">
          <p className="text-sm font-medium text-gray-800 dark:text-white/90">{reading.id.slice(0, 8)}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t("tasks.statusLabel")}: {translateReadingStatus(reading.status as ReadingStatus, t)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t("tasks.readingAt")}: {formatDate(reading.readingAt, t("common.notAvailable"))}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t("common.index")}: {reading.primaryIndex.toString()}
            {reading.secondaryIndex ? ` | ${reading.secondaryIndex.toString()}` : ""}
          </p>
          {href ? (
            <Link href={href} className="inline-flex text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">
              {t("tasks.openReadingDetail")}
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}
