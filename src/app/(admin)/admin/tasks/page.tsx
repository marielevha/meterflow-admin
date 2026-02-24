import { Metadata } from "next";
import Link from "next/link";
import { TaskPriority, TaskStatus, TaskType, UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import ComponentCard from "@/components/common/ComponentCard";
import TasksFilters from "@/components/tasks/TasksFilters";
import Badge from "@/components/ui/badge/Badge";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentStaffFromServerAction } from "@/lib/auth/staffActionSession";
import { listTasks } from "@/lib/backoffice/tasks";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Tasks | MeterFlow Dashboard",
  description: "Operational tasks management",
};

const PAGE_SIZE_OPTIONS = [10, 20, 50];

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValue(input: string | string[] | undefined): string {
  if (Array.isArray(input)) return input[0] ?? "";
  return input ?? "";
}

function normalizeEnum<T extends string>(value: string, options: readonly T[]): T | "" {
  return (options as readonly string[]).includes(value) ? (value as T) : "";
}

function priorityBadge(priority: TaskPriority) {
  if (priority === TaskPriority.CRITICAL) return "error" as const;
  if (priority === TaskPriority.HIGH) return "warning" as const;
  if (priority === TaskPriority.MEDIUM) return "info" as const;
  return "light" as const;
}

function statusBadge(status: TaskStatus) {
  if (status === TaskStatus.DONE) return "success" as const;
  if (status === TaskStatus.BLOCKED) return "error" as const;
  if (status === TaskStatus.IN_PROGRESS) return "info" as const;
  if (status === TaskStatus.CANCELED) return "warning" as const;
  return "light" as const;
}

function formatDate(value: Date | null) {
  if (!value) return "-";
  return value.toISOString().slice(0, 16).replace("T", " ");
}

function assigneeLabel(assignee?: {
  firstName: string | null;
  lastName: string | null;
  username: string | null;
} | null) {
  if (!assignee) return "Unassigned";
  const name = [assignee.firstName, assignee.lastName].filter(Boolean).join(" ").trim();
  return name || assignee.username || "Agent";
}

export default async function TasksPage({ searchParams }: { searchParams: SearchParams }) {
  const authUser = await getCurrentStaffFromServerAction();
  if (!authUser) redirect("/signin");

  const resolvedSearchParams = await searchParams;
  const q = firstValue(resolvedSearchParams.q).trim();
  const status = normalizeEnum(firstValue(resolvedSearchParams.status).trim(), Object.values(TaskStatus));
  const priority = normalizeEnum(
    firstValue(resolvedSearchParams.priority).trim(),
    Object.values(TaskPriority),
  );
  const type = normalizeEnum(firstValue(resolvedSearchParams.type).trim(), Object.values(TaskType));
  const assignedToId = firstValue(resolvedSearchParams.assignedToId).trim();
  const pageSizeRaw = Number(firstValue(resolvedSearchParams.pageSize) || "10");
  const pageSize = PAGE_SIZE_OPTIONS.includes(pageSizeRaw) ? pageSizeRaw : 10;
  const page = Math.max(1, Number(firstValue(resolvedSearchParams.page) || "1"));

  const [tasksResult, agents, stats] = await Promise.all([
    listTasks(
      { id: authUser.id, role: authUser.role },
      {
        q,
        status,
        priority,
        type,
        assignedToId,
        page,
        pageSize,
      },
    ),
    prisma.user.findMany({
      where: {
        role: UserRole.AGENT,
        status: "ACTIVE",
        deletedAt: null,
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: { id: true, firstName: true, lastName: true, username: true },
    }),
    prisma.task.groupBy({
      by: ["status"],
      where: {
        deletedAt: null,
        ...(authUser.role === UserRole.AGENT ? { assignedToId: authUser.id } : {}),
      },
      _count: { _all: true },
    }),
  ]);

  if (tasksResult.status !== 200) {
    return (
      <div>
        <PageBreadcrumb pageTitle="Tasks" />
        <ComponentCard title="Tasks" desc="Unable to load tasks.">
          <p className="text-sm text-error-600 dark:text-error-400">{tasksResult.body.error || "load_failed"}</p>
        </ComponentCard>
      </div>
    );
  }

  const tasks = tasksResult.body.tasks ?? [];
  const pagination = tasksResult.body.pagination;
  if (!pagination) {
    return (
      <div>
        <PageBreadcrumb pageTitle="Tasks" />
        <ComponentCard title="Tasks" desc="Unable to load tasks.">
          <p className="text-sm text-error-600 dark:text-error-400">invalid_tasks_pagination</p>
        </ComponentCard>
      </div>
    );
  }

  const counts = {
    total: pagination.total,
    open: stats.find((s) => s.status === TaskStatus.OPEN)?._count._all || 0,
    inProgress: stats.find((s) => s.status === TaskStatus.IN_PROGRESS)?._count._all || 0,
    blocked: stats.find((s) => s.status === TaskStatus.BLOCKED)?._count._all || 0,
    done: stats.find((s) => s.status === TaskStatus.DONE)?._count._all || 0,
  };

  const buildHref = (overrides: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    const nextQ = overrides.q ?? q;
    const nextStatus = overrides.status ?? status;
    const nextPriority = overrides.priority ?? priority;
    const nextType = overrides.type ?? type;
    const nextAssignedToId = overrides.assignedToId ?? assignedToId;
    const nextPageSize = overrides.pageSize ?? pageSize;
    const nextPage = overrides.page ?? pagination.page;

    if (nextQ) params.set("q", String(nextQ));
    if (nextStatus) params.set("status", String(nextStatus));
    if (nextPriority) params.set("priority", String(nextPriority));
    if (nextType) params.set("type", String(nextType));
    if (nextAssignedToId) params.set("assignedToId", String(nextAssignedToId));
    params.set("pageSize", String(nextPageSize));
    if (Number(nextPage) > 1) params.set("page", String(nextPage));

    return `/admin/tasks${params.toString() ? `?${params.toString()}` : ""}`;
  };

  const startPage = Math.max(1, pagination.page - 2);
  const endPage = Math.min(pagination.totalPages, startPage + 4);
  const visiblePages = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);

  return (
    <div>
      <PageBreadcrumb pageTitle="Tasks" />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total" value={counts.total} />
        <StatCard label="Open" value={counts.open} />
        <StatCard label="In progress" value={counts.inProgress} />
        <StatCard label="Blocked" value={counts.blocked} />
        <StatCard label="Done" value={counts.done} />
      </div>

      <div className="mb-4 flex justify-end">
        <Link
          href="/admin/tasks/create"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600"
        >
          Create task
        </Link>
      </div>

      <ComponentCard title="Task queue" desc="Planification et suivi des actions terrain.">
        <TasksFilters
          initialQ={q}
          initialStatus={status}
          initialPriority={priority}
          initialType={type}
          initialAssignedToId={assignedToId}
          initialPageSize={pageSize}
          statusOptions={Object.values(TaskStatus)}
          priorityOptions={Object.values(TaskPriority)}
          typeOptions={Object.values(TaskType)}
          assigneeOptions={agents.map((agent) => ({
            id: agent.id,
            label:
              [agent.firstName, agent.lastName].filter(Boolean).join(" ").trim() ||
              agent.username ||
              "Agent",
          }))}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
        />

        <div className="max-w-full overflow-x-auto">
          <div className="min-w-[1280px] overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>
                  <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Title</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Type</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Status</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Priority</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Assignee</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Meter</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Due</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Actions</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {tasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="px-5 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                      No tasks found.
                    </TableCell>
                  </TableRow>
                ) : (
                  tasks.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell className="px-5 py-4 text-start">
                        <p className="text-sm font-medium text-gray-800 dark:text-white/90">{task.title}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{task.description || "No description"}</p>
                      </TableCell>
                      <TableCell className="px-5 py-4 text-sm text-gray-700 dark:text-gray-300">{task.type}</TableCell>
                      <TableCell className="px-5 py-4"><Badge size="sm" color={statusBadge(task.status)}>{task.status}</Badge></TableCell>
                      <TableCell className="px-5 py-4"><Badge size="sm" color={priorityBadge(task.priority)}>{task.priority}</Badge></TableCell>
                      <TableCell className="px-5 py-4 text-sm text-gray-700 dark:text-gray-300">{assigneeLabel(task.assignedTo)}</TableCell>
                      <TableCell className="px-5 py-4 text-sm text-gray-700 dark:text-gray-300">
                        {task.meter?.serialNumber || "N/A"}
                        <p className="text-xs text-gray-500 dark:text-gray-400">{task.meter?.meterReference || "-"}</p>
                      </TableCell>
                      <TableCell className="px-5 py-4 text-sm text-gray-700 dark:text-gray-300">{formatDate(task.dueAt)}</TableCell>
                      <TableCell className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <Link href={`/admin/tasks/${task.id}`} className="inline-flex h-8 items-center rounded-md border border-gray-300 px-3 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]">View</Link>
                          <Link href={`/admin/tasks/${task.id}/edit`} className="inline-flex h-8 items-center rounded-md border border-gray-300 px-3 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]">Edit</Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Showing {tasks.length === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1} - {Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total}
          </p>
          <div className="flex items-center gap-2">
            <Link
              href={buildHref({ page: pagination.page - 1 })}
              aria-disabled={pagination.page <= 1}
              className={`inline-flex h-10 items-center justify-center rounded-lg border px-3 text-sm ${
                pagination.page <= 1
                  ? "pointer-events-none border-gray-200 text-gray-400 dark:border-gray-800 dark:text-gray-600"
                  : "border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]"
              }`}
            >
              Previous
            </Link>

            {visiblePages.map((pageNumber) => (
              <Link
                key={pageNumber}
                href={buildHref({ page: pageNumber })}
                className={`inline-flex h-10 w-10 items-center justify-center rounded-lg text-sm font-medium ${
                  pageNumber === pagination.page
                    ? "bg-brand-500 text-white"
                    : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/[0.03]"
                }`}
              >
                {pageNumber}
              </Link>
            ))}

            <Link
              href={buildHref({ page: pagination.page + 1 })}
              aria-disabled={pagination.page >= pagination.totalPages}
              className={`inline-flex h-10 items-center justify-center rounded-lg border px-3 text-sm ${
                pagination.page >= pagination.totalPages
                  ? "pointer-events-none border-gray-200 text-gray-400 dark:border-gray-800 dark:text-gray-600"
                  : "border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]"
              }`}
            >
              Next
            </Link>
          </div>
        </div>
      </ComponentCard>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <h3 className="mt-2 text-2xl font-semibold text-gray-800 dark:text-white/90">{value}</h3>
    </div>
  );
}
