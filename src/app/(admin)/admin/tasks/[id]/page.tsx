import { Metadata } from "next";
import Link from "next/link";
import { TaskItemStatus, TaskStatus } from "@prisma/client";
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
  title: "Task Detail | MeterFlow Dashboard",
  description: "Task detail with checklist, comments and attachments",
};

function statusBadge(status: TaskStatus) {
  if (status === TaskStatus.DONE) return "success" as const;
  if (status === TaskStatus.BLOCKED) return "error" as const;
  if (status === TaskStatus.IN_PROGRESS) return "info" as const;
  if (status === TaskStatus.CANCELED) return "warning" as const;
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

function personLabel(person?: { firstName: string | null; lastName: string | null; username: string | null } | null) {
  if (!person) return "N/A";
  return [person.firstName, person.lastName].filter(Boolean).join(" ").trim() || person.username || "User";
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
          <Link href={`/admin/tasks/${task.id}/edit`} className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]">Edit</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className="xl:col-span-2 space-y-6">
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
                          <button type="submit" className="inline-flex h-8 items-center rounded-md border border-gray-300 px-3 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]">
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
              <input name="title" placeholder="Checklist item title" className="md:col-span-5 h-11 rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90" required />
              <input name="details" placeholder="Details" className="md:col-span-5 h-11 rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90" />
              <input name="sortOrder" type="number" defaultValue={0} className="md:col-span-1 h-11 rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90" />
              <button type="submit" className="md:col-span-1 h-11 rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600">Add</button>
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
              <textarea name="comment" rows={3} placeholder="Write a comment" className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90" required />
              <label className="inline-flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <input type="checkbox" name="isInternal" value="1" defaultChecked className="h-3.5 w-3.5" />
                Internal comment
              </label>
              <button type="submit" className="inline-flex h-10 items-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600">Add comment</button>
            </form>
          </div>
        </section>

        <aside className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Task info</h3>
            <ul className="mt-3 space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <li><span className="text-gray-500 dark:text-gray-400">Type:</span> {task.type}</li>
              <li><span className="text-gray-500 dark:text-gray-400">Priority:</span> {task.priority}</li>
              <li><span className="text-gray-500 dark:text-gray-400">Assigned:</span> {personLabel(task.assignedTo)}</li>
              <li><span className="text-gray-500 dark:text-gray-400">Created by:</span> {personLabel(task.createdBy)}</li>
              <li><span className="text-gray-500 dark:text-gray-400">Created at:</span> {formatDate(task.createdAt)}</li>
              <li><span className="text-gray-500 dark:text-gray-400">Due at:</span> {formatDate(task.dueAt)}</li>
              <li><span className="text-gray-500 dark:text-gray-400">Closed at:</span> {formatDate(task.closedAt)}</li>
            </ul>
            <div className="mt-4 rounded-lg bg-gray-50 p-3 text-xs text-gray-500 dark:bg-white/[0.02] dark:text-gray-400">
              Meter: {task.meter?.serialNumber || "N/A"} / {task.meter?.meterReference || "-"}
            </div>
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
              <input name="fileUrl" placeholder="https://..." className="h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90" required />
              <input name="fileName" placeholder="file name" className="h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90" required />
              <div className="grid grid-cols-2 gap-2">
                <input name="mimeType" placeholder="mime type" className="h-10 rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90" />
                <input name="fileSizeBytes" type="number" placeholder="size bytes" className="h-10 rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90" />
              </div>
              <input name="fileHash" placeholder="file hash (optional)" className="h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90" />
              <button type="submit" className="inline-flex h-10 items-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600">Add attachment</button>
            </form>
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
