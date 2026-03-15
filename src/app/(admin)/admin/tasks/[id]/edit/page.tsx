import { Metadata } from "next";
import Link from "next/link";
import { TaskPriority, TaskStatus, TaskType, UserRole, UserStatus } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import SearchableSelect from "@/components/form/SearchableSelect";
import { getCurrentStaffFromServerAction } from "@/lib/auth/staffActionSession";
import { getTaskDetail } from "@/lib/backoffice/tasks";
import { prisma } from "@/lib/prisma";
import { updateTaskAction } from "./actions";

export const metadata: Metadata = {
  title: "Edit Task",
  description: "Update operational task",
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

function mapError(code: string) {
  if (!code) return "";
  return code.replaceAll("_", " ");
}

function personLabel(person?: { firstName: string | null; lastName: string | null; username: string | null } | null) {
  if (!person) return "Unassigned";
  return [person.firstName, person.lastName].filter(Boolean).join(" ").trim() || person.username || "Agent";
}

function dateLabel(date: Date | null) {
  if (!date) return "-";
  return date.toISOString().slice(0, 16).replace("T", " ");
}

export default async function EditTaskPage({
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
  const errorCode = firstValue(resolvedSearchParams.error);

  const [taskResult, agents] = await Promise.all([
    getTaskDetail({ id: staff.id, role: staff.role }, id),
    prisma.user.findMany({
      where: {
        role: UserRole.AGENT,
        status: UserStatus.ACTIVE,
        deletedAt: null,
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: { id: true, firstName: true, lastName: true, phone: true },
    }),
  ]);

  if (taskResult.status === 404) notFound();
  if (taskResult.status !== 200) {
    redirect(`/admin/tasks?error=${taskResult.body.error || "task_load_failed"}`);
  }

  const task = taskResult.body.task;
  if (!task) notFound();

  const isManager = staff.role === UserRole.ADMIN || staff.role === UserRole.SUPERVISOR;
  const submit = updateTaskAction.bind(null, task.id);

  return (
    <div>
      <PageBreadcrumb pageTitle="Edit task" />

      <form action={submit} className="space-y-6">
        {errorCode ? (
          <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300">
            {mapError(errorCode)}
          </div>
        ) : null}

        {!isManager ? (
          <div className="rounded-xl border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-300">
            Your role can update execution status only. Assignment, priority and base metadata are manager-only.
          </div>
        ) : null}

        <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <InfoCard label="Task ID" value={task.id.slice(0, 8)} />
          <InfoCard label="Current status" value={task.status} />
          <InfoCard label="Assignee" value={personLabel(task.assignedTo)} />
          <InfoCard label="Due" value={dateLabel(task.dueAt)} />
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="mb-6">
            <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">1) Lifecycle controls</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Update state first, then adjust ownership and detail fields if you are manager.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                name="status"
                defaultValue={task.status}
                className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
              >
                {Object.values(TaskStatus).map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="dueAt">Due date</Label>
              <Input
                id="dueAt"
                name="dueAt"
                type="datetime-local"
                defaultValue={toDatetimeLocal(task.dueAt)}
                disabled={!isManager}
              />
              {!isManager ? null : (
                <label className="mt-2 inline-flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <input type="checkbox" name="clearDueAt" value="1" className="h-3.5 w-3.5" />
                  Clear due date
                </label>
              )}
            </div>

            <div>
              <Label htmlFor="assignedToId">Assigned agent</Label>
              {isManager ? (
                <SearchableSelect
                  id="assignedToId"
                  name="assignedToId"
                  defaultValue={task.assignedToId || ""}
                  emptyLabel="Unassigned"
                  placeholder="Search agent"
                  options={agents.map((agent) => ({
                    value: agent.id,
                    label: [agent.firstName, agent.lastName].filter(Boolean).join(" ").trim() || "Agent",
                    hint: agent.phone,
                  }))}
                />
              ) : (
                <Input id="assignedToId_readonly" value={personLabel(task.assignedTo)} disabled />
              )}
              {!isManager ? null : (
                <label className="mt-2 inline-flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <input type="checkbox" name="clearAssignee" value="1" className="h-3.5 w-3.5" />
                  Unassign task
                </label>
              )}
            </div>

            <div>
              <Label htmlFor="priority">Priority</Label>
              <select
                id="priority"
                name="priority"
                defaultValue={task.priority}
                disabled={!isManager}
                className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
              >
                {Object.values(TaskPriority).map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="mb-6">
            <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">2) Task metadata</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Functional type and description for downstream teams and audit.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" defaultValue={task.title} disabled={!isManager} />
            </div>

            <div>
              <Label htmlFor="type">Type</Label>
              <select
                id="type"
                name="type"
                defaultValue={task.type}
                disabled={!isManager}
                className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
              >
                {Object.values(TaskType).map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                name="description"
                rows={4}
                defaultValue={task.description || ""}
                disabled={!isManager}
                className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-3 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
              />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Linked entities (read-only)</h3>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <ReadonlyField label="Meter" value={`${task.meter?.serialNumber || "-"} / ${task.meter?.meterReference || "-"}`} />
            <ReadonlyField label="Reading" value={task.reading?.id || "Not linked"} />
            <ReadonlyField label="Created by" value={personLabel(task.createdBy)} />
            <ReadonlyField label="Created at" value={dateLabel(task.createdAt)} />
          </div>
        </section>

        <div className="sticky bottom-4 z-30 rounded-xl border border-gray-200 bg-white/90 p-4 backdrop-blur dark:border-gray-800 dark:bg-gray-900/90">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Changes are tracked in audit events when task is linked to a reading.
            </p>
            <div className="flex items-center justify-end gap-2">
              <Link href={`/admin/tasks/${task.id}`} className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]">Cancel</Link>
              <button type="submit" className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600">Save changes</button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
      <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-2 text-sm font-semibold text-gray-800 dark:text-white/90">{value}</p>
    </div>
  );
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-white/[0.02] dark:text-gray-200">
        {value}
      </p>
    </div>
  );
}
