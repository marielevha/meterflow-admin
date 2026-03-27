import { Metadata } from "next";
import Link from "next/link";
import { Prisma, TaskPriority, TaskStatus, TaskType, UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { EyeIcon, PencilIcon } from "@/icons";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import ComponentCard from "@/components/common/ComponentCard";
import TaskPulseChartCard from "@/components/tasks/TaskPulseChartCard";
import TasksFilters from "@/components/tasks/TasksFilters";
import Badge from "@/components/ui/badge/Badge";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { getAdminTranslator } from "@/lib/admin-i18n/server";
import {
  ADMIN_PERMISSION_GROUPS,
  hasAnyPermissionCode,
  requireAdminPermissions,
} from "@/lib/auth/adminPermissions";
import { getCurrentStaffPermissionCodes } from "@/lib/auth/staffServerSession";
import { listTasks } from "@/lib/backoffice/tasks";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Tasks",
  description: "Operational tasks management",
};

const PAGE_SIZE_OPTIONS = [10, 20, 50];

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const ACTIVE_TASK_STATUSES = [TaskStatus.OPEN, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED] as const;
type AdminTranslatorFn = (
  key: string,
  values?: Record<string, string | number>
) => string;

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

function formatDate(value: Date | null, locale: string, fallback: string) {
  if (!value) return fallback;
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function formatCustomer(customer?: {
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  phone: string;
} | null, fallback = "N/A") {
  if (!customer) return fallback;
  return (
    [customer.firstName, customer.lastName].filter(Boolean).join(" ").trim() ||
    customer.username ||
    customer.phone
  );
}

function assigneeLabel(assignee?: {
  firstName: string | null;
  lastName: string | null;
  username: string | null;
} | null, unassignedFallback = "Unassigned", agentFallback = "Agent") {
  if (!assignee) return unassignedFallback;
  const name = [assignee.firstName, assignee.lastName].filter(Boolean).join(" ").trim();
  return name || assignee.username || agentFallback;
}

function taskStatusLabel(status: TaskStatus, t: AdminTranslatorFn) {
  if (status === TaskStatus.OPEN) return t("tasks.open");
  if (status === TaskStatus.IN_PROGRESS) return t("tasks.inProgress");
  if (status === TaskStatus.BLOCKED) return t("tasks.blocked");
  if (status === TaskStatus.DONE) return t("tasks.done");
  if (status === TaskStatus.CANCELED) return t("tasks.canceled");
  return status;
}

function taskPriorityLabel(priority: TaskPriority, t: AdminTranslatorFn) {
  if (priority === TaskPriority.LOW) return t("tasks.priorityLow");
  if (priority === TaskPriority.MEDIUM) return t("tasks.priorityMedium");
  if (priority === TaskPriority.HIGH) return t("tasks.priorityHigh");
  if (priority === TaskPriority.CRITICAL) return t("tasks.priorityCritical");
  return priority;
}

function taskTypeLabel(type: TaskType, t: AdminTranslatorFn) {
  if (type === TaskType.FIELD_RECHECK) return t("tasks.typeFieldRecheck");
  if (type === TaskType.FRAUD_INVESTIGATION) return t("tasks.typeFraudInvestigation");
  if (type === TaskType.METER_VERIFICATION) return t("tasks.typeMeterVerification");
  if (type === TaskType.GENERAL) return t("tasks.typeGeneral");
  return type;
}

export default async function TasksPage({ searchParams }: { searchParams: SearchParams }) {
  const { locale, t } = await getAdminTranslator();
  const localeCode = locale === "fr" ? "fr-FR" : locale === "ln" ? "ln-CG" : "en-US";
  const authUser = await requireAdminPermissions("/admin/tasks", ADMIN_PERMISSION_GROUPS.tasksView);
  const permissionCodes = await getCurrentStaffPermissionCodes(authUser.id);
  const canCreateTasks = hasAnyPermissionCode(permissionCodes, ADMIN_PERMISSION_GROUPS.tasksCreate);
  const canEditTasks = hasAnyPermissionCode(permissionCodes, ADMIN_PERMISSION_GROUPS.tasksEditPage);

  const resolvedSearchParams = await searchParams;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const q = firstValue(resolvedSearchParams.q).trim();
  const status = normalizeEnum(firstValue(resolvedSearchParams.status).trim(), Object.values(TaskStatus));
  const priority = normalizeEnum(
    firstValue(resolvedSearchParams.priority).trim(),
    Object.values(TaskPriority),
  );
  const type = normalizeEnum(firstValue(resolvedSearchParams.type).trim(), Object.values(TaskType));
  const assignedToId = firstValue(resolvedSearchParams.assignedToId).trim();
  const assignmentState = firstValue(resolvedSearchParams.assignmentState).trim();
  const dueState = firstValue(resolvedSearchParams.dueState).trim();
  const reportState = firstValue(resolvedSearchParams.reportState).trim();
  const pageSizeRaw = Number(firstValue(resolvedSearchParams.pageSize) || "10");
  const pageSize = PAGE_SIZE_OPTIONS.includes(pageSizeRaw) ? pageSizeRaw : 10;
  const page = Math.max(1, Number(firstValue(resolvedSearchParams.page) || "1"));

  const baseScopeWhere: Prisma.TaskWhereInput = {
    deletedAt: null,
    ...(authUser.role === UserRole.AGENT ? { assignedToId: authUser.id } : {}),
  };

  const [tasksResult, agents, stats] = await Promise.all([
    listTasks(
      { id: authUser.id, role: authUser.role },
      {
        q,
        status,
        priority,
        type,
        assignedToId,
        assignmentState,
        dueState,
        reportState,
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
    prisma.$transaction([
      prisma.task.groupBy({
        by: ["status"],
        where: baseScopeWhere,
        orderBy: { status: "asc" },
        _count: { _all: true },
      }),
      prisma.task.count({
        where: {
          ...baseScopeWhere,
          dueAt: { lt: todayStart },
          status: { in: [...ACTIVE_TASK_STATUSES] },
        },
      }),
      prisma.task.count({
        where: {
          ...baseScopeWhere,
          assignedToId: null,
        },
      }),
      prisma.task.count({
        where: {
          ...baseScopeWhere,
          fieldSubmittedAt: { not: null },
        },
      }),
      prisma.task.count({
        where: {
          ...baseScopeWhere,
          dueAt: {
            gte: todayStart,
            lt: tomorrowStart,
          },
          status: { in: [...ACTIVE_TASK_STATUSES] },
        },
      }),
    ]),
  ]);

  if (tasksResult.status !== 200) {
    return (
      <div>
        <PageBreadcrumb pageTitle={t("tasks.pageTitle")} />
        <ComponentCard title={t("tasks.pageTitle")} desc={t("tasks.queueDesc")}>
          <p className="text-sm text-error-600 dark:text-error-400">
            {tasksResult.body.error || "load_failed"}
          </p>
        </ComponentCard>
      </div>
    );
  }

  const tasks = tasksResult.body.tasks ?? [];
  const pagination = tasksResult.body.pagination;
  if (!pagination) {
    return (
      <div>
        <PageBreadcrumb pageTitle={t("tasks.pageTitle")} />
        <ComponentCard title={t("tasks.pageTitle")} desc={t("tasks.queueDesc")}>
          <p className="text-sm text-error-600 dark:text-error-400">{t("tasks.errorInvalidPagination")}</p>
        </ComponentCard>
      </div>
    );
  }

  const statusRows = stats[0] as Array<{ status: TaskStatus; _count: { _all: number } }>;
  const counts = {
    total: pagination.total,
    open: statusRows.find((s) => s.status === TaskStatus.OPEN)?._count._all || 0,
    inProgress: statusRows.find((s) => s.status === TaskStatus.IN_PROGRESS)?._count._all || 0,
    blocked: statusRows.find((s) => s.status === TaskStatus.BLOCKED)?._count._all || 0,
    done: statusRows.find((s) => s.status === TaskStatus.DONE)?._count._all || 0,
    canceled: statusRows.find((s) => s.status === TaskStatus.CANCELED)?._count._all || 0,
    overdue: stats[1],
    unassigned: stats[2],
    withReport: stats[3],
    dueToday: stats[4],
  };

  const buildHref = (overrides: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    const nextQ = overrides.q ?? q;
    const nextStatus = overrides.status ?? status;
    const nextPriority = overrides.priority ?? priority;
    const nextType = overrides.type ?? type;
    const nextAssignedToId = overrides.assignedToId ?? assignedToId;
    const nextAssignmentState = overrides.assignmentState ?? assignmentState;
    const nextDueState = overrides.dueState ?? dueState;
    const nextReportState = overrides.reportState ?? reportState;
    const nextPageSize = overrides.pageSize ?? pageSize;
    const nextPage = overrides.page ?? pagination.page;

    if (nextQ) params.set("q", String(nextQ));
    if (nextStatus) params.set("status", String(nextStatus));
    if (nextPriority) params.set("priority", String(nextPriority));
    if (nextType) params.set("type", String(nextType));
    if (nextAssignedToId) params.set("assignedToId", String(nextAssignedToId));
    if (nextAssignmentState) params.set("assignmentState", String(nextAssignmentState));
    if (nextDueState) params.set("dueState", String(nextDueState));
    if (nextReportState) params.set("reportState", String(nextReportState));
    params.set("pageSize", String(nextPageSize));
    if (Number(nextPage) > 1) params.set("page", String(nextPage));

    return `/admin/tasks${params.toString() ? `?${params.toString()}` : ""}`;
  };

  const startPage = Math.max(1, pagination.page - 2);
  const endPage = Math.min(pagination.totalPages, startPage + 4);
  const visiblePages = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);

  return (
    <div>
      <PageBreadcrumb pageTitle={t("tasks.pageTitle")} />

      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <TaskPulseChartCard counts={counts} />
        <TaskAttentionCard
          overdue={counts.overdue}
          dueToday={counts.dueToday}
          unassigned={counts.unassigned}
          withReport={counts.withReport}
          t={t}
        />
      </div>

      {canCreateTasks ? (
        <div className="mb-4 flex justify-end">
          <Link
            href="/admin/tasks/create"
            className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600 sm:h-10 sm:w-auto"
          >
            {t("tasks.createTask")}
          </Link>
        </div>
      ) : null}

      <ComponentCard title={t("tasks.queueTitle")} desc={t("tasks.queueDesc")}>
        <TasksFilters
          initialQ={q}
          initialStatus={status}
          initialPriority={priority}
          initialType={type}
          initialAssignedToId={assignedToId}
          initialAssignmentState={assignmentState}
          initialDueState={dueState}
          initialReportState={reportState}
          initialPageSize={pageSize}
          statusOptions={Object.values(TaskStatus)}
          priorityOptions={Object.values(TaskPriority)}
          typeOptions={Object.values(TaskType)}
          assigneeOptions={agents.map((agent) => ({
            id: agent.id,
            label:
              [agent.firstName, agent.lastName].filter(Boolean).join(" ").trim() ||
              agent.username ||
              t("common.unknown"),
          }))}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
        />

        <div className="space-y-4 lg:hidden">
          {tasks.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-500 dark:border-white/[0.05] dark:bg-white/[0.03] dark:text-gray-400">
              {t("tasks.noTasksFound")}
            </div>
          ) : (
            tasks.map((task) => (
              <TaskMobileCard
                key={task.id}
                task={task}
                todayStart={todayStart}
                tomorrowStart={tomorrowStart}
                locale={localeCode}
                t={t}
              />
            ))
          )}
        </div>

        <div className="hidden max-w-full overflow-x-auto lg:block">
          <div className="min-w-[1480px] overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>
                  <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">{t("tasks.tableTitle")}</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">{t("tasks.tableFollowUp")}</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">{t("tasks.tableType")}</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">{t("tasks.tableStatus")}</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">{t("tasks.tablePriority")}</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">{t("tasks.tableAssignee")}</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">{t("tasks.tableMeterClient")}</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">{t("tasks.tableFieldReport")}</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">{t("tasks.tableDue")}</TableCell>
                  <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">{t("tasks.tableActions")}</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {tasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="px-5 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                      {t("tasks.noTasksFound")}
                    </TableCell>
                  </TableRow>
                ) : (
                  tasks.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell className="px-5 py-4 text-start">
                        <p className="text-sm font-medium text-gray-800 dark:text-white/90">{task.title}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{task.description || t("common.noDescription")}</p>
                      </TableCell>
                      <TableCell className="px-5 py-4 text-sm text-gray-700 dark:text-gray-300">
                        <div className="flex flex-col gap-2">
                          {task.status !== TaskStatus.DONE && task.status !== TaskStatus.CANCELED && task.dueAt && task.dueAt < todayStart ? (
                            <Badge size="sm" color="error">{t("tasks.overdue")}</Badge>
                          ) : null}
                          {task.dueAt && task.dueAt >= todayStart && task.dueAt < tomorrowStart ? (
                            <Badge size="sm" color="warning">{t("tasks.dueToday")}</Badge>
                          ) : null}
                          {task.startedAt ? (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {t("tasks.mobileStarted")} {formatDate(task.startedAt, localeCode, "-")}
                            </p>
                          ) : (
                            <p className="text-xs text-gray-500 dark:text-gray-400">{t("tasks.notStarted")}</p>
                          )}
                          {task.reading ? (
                            <Link href={`/admin/readings/${task.reading.id}`} className="text-xs text-brand-600 hover:underline dark:text-brand-400">
                              {t("tasks.sourceReading")}: {task.reading.status}
                            </Link>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="px-5 py-4 text-sm text-gray-700 dark:text-gray-300">{taskTypeLabel(task.type, t)}</TableCell>
                      <TableCell className="px-5 py-4"><Badge size="sm" color={statusBadge(task.status)}>{taskStatusLabel(task.status, t)}</Badge></TableCell>
                      <TableCell className="px-5 py-4"><Badge size="sm" color={priorityBadge(task.priority)}>{taskPriorityLabel(task.priority, t)}</Badge></TableCell>
                      <TableCell className="px-5 py-4 text-sm text-gray-700 dark:text-gray-300">
                        <p>{assigneeLabel(task.assignedTo, t("tasks.unassigned"), t("common.unknown"))}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {task.assignedTo ? t("tasks.assigned") : t("tasks.needsAssignment")}
                        </p>
                      </TableCell>
                      <TableCell className="px-5 py-4 text-sm text-gray-700 dark:text-gray-300">
                        {task.meter?.serialNumber || t("common.notAvailable")}
                        <p className="text-xs text-gray-500 dark:text-gray-400">{task.meter?.meterReference || "-"}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{formatCustomer(task.meter?.customer, t("common.notAvailable"))}</p>
                      </TableCell>
                      <TableCell className="px-5 py-4 text-sm text-gray-700 dark:text-gray-300">
                        {task.fieldSubmittedAt ? (
                          <div className="flex flex-col gap-1">
                            <Badge size="sm" color="success">{t("tasks.reportReceived")}</Badge>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(task.fieldSubmittedAt, localeCode, "-")}</p>
                            {task.resolutionCode ? (
                              <p className="text-xs text-gray-500 dark:text-gray-400">{task.resolutionCode}</p>
                            ) : null}
                            {task.reportedReading ? (
                              <Link href={`/admin/readings/${task.reportedReading.id}`} className="text-xs text-brand-600 hover:underline dark:text-brand-400">
                                {t("tasks.reportedReading")}: {task.reportedReading.status}
                              </Link>
                            ) : null}
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1">
                            <Badge size="sm" color="light">{t("tasks.awaitingReport")}</Badge>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{t("tasks.noFieldReport")}</p>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="px-5 py-4 text-sm text-gray-700 dark:text-gray-300">
                        {formatDate(task.dueAt, localeCode, "-")}
                      </TableCell>
                      <TableCell className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/admin/tasks/${task.id}`}
                            title={t("tasks.viewTask")}
                            aria-label={t("tasks.viewTask")}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]"
                          >
                            <EyeIcon className="h-4 w-4 fill-current" />
                          </Link>
                          {canEditTasks ? (
                            <Link
                              href={`/admin/tasks/${task.id}/edit`}
                              title={t("tasks.editTask")}
                              aria-label={t("tasks.editTask")}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]"
                            >
                              <PencilIcon className="h-4 w-4 fill-current" />
                            </Link>
                          ) : null}
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
          <p className="text-center text-sm text-gray-500 dark:text-gray-400 sm:text-left">
            {t("tasks.showingSummary", {
              start: tasks.length === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1,
              end: Math.min(pagination.page * pagination.pageSize, pagination.total),
              total: pagination.total,
            })}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
            <Link
              href={buildHref({ page: pagination.page - 1 })}
              aria-disabled={pagination.page <= 1}
              className={`inline-flex h-10 min-w-[88px] items-center justify-center rounded-lg border px-3 text-sm ${
                pagination.page <= 1
                  ? "pointer-events-none border-gray-200 text-gray-400 dark:border-gray-800 dark:text-gray-600"
                  : "border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]"
              }`}
            >
              {t("common.previous")}
            </Link>

            {visiblePages.map((pageNumber) => (
              <Link
                key={pageNumber}
                href={buildHref({ page: pageNumber })}
                className={`inline-flex h-10 min-w-[40px] items-center justify-center rounded-lg px-2 text-sm font-medium ${
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
              className={`inline-flex h-10 min-w-[88px] items-center justify-center rounded-lg border px-3 text-sm ${
                pagination.page >= pagination.totalPages
                  ? "pointer-events-none border-gray-200 text-gray-400 dark:border-gray-800 dark:text-gray-600"
                  : "border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]"
              }`}
            >
              {t("common.next")}
            </Link>
          </div>
        </div>
      </ComponentCard>
    </div>
  );
}

function TaskMobileCard({
  task,
  todayStart,
  tomorrowStart,
  locale,
  t,
}: {
  task: {
    id: string;
    title: string;
    description: string | null;
    type: TaskType;
    status: TaskStatus;
    priority: TaskPriority;
    dueAt: Date | null;
    startedAt: Date | null;
    fieldSubmittedAt: Date | null;
    resolutionCode: string | null;
    reading?: { id: string; status: string } | null;
    reportedReading?: { id: string; status: string } | null;
    assignedTo?: {
      firstName: string | null;
      lastName: string | null;
      username: string | null;
    } | null;
    meter?: {
      serialNumber: string;
      meterReference: string | null;
      customer?: {
        firstName: string | null;
        lastName: string | null;
        username: string | null;
        phone: string;
      } | null;
    } | null;
  };
  todayStart: Date;
  tomorrowStart: Date;
  locale: string;
  t: AdminTranslatorFn;
}) {
  const isOverdue =
    task.status !== TaskStatus.DONE &&
    task.status !== TaskStatus.CANCELED &&
    !!task.dueAt &&
    task.dueAt < todayStart;
  const isDueToday =
    !!task.dueAt && task.dueAt >= todayStart && task.dueAt < tomorrowStart;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-white/[0.05] dark:bg-white/[0.03]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-800 dark:text-white/90">{task.title}</p>
          <p className="mt-1 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
            {task.description || t("common.noDescription")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/tasks/${task.id}`}
            title={t("tasks.viewTask")}
            aria-label={t("tasks.viewTask")}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]"
          >
            <EyeIcon className="h-4 w-4 fill-current" />
          </Link>
          {canEditTasks ? (
            <Link
              href={`/admin/tasks/${task.id}/edit`}
              title={t("tasks.editTask")}
              aria-label={t("tasks.editTask")}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]"
            >
              <PencilIcon className="h-4 w-4 fill-current" />
            </Link>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Badge size="sm" color={statusBadge(task.status)}>{taskStatusLabel(task.status, t)}</Badge>
        <Badge size="sm" color={priorityBadge(task.priority)}>{taskPriorityLabel(task.priority, t)}</Badge>
        {isOverdue ? <Badge size="sm" color="error">{t("tasks.overdue")}</Badge> : null}
        {isDueToday ? <Badge size="sm" color="warning">{t("tasks.dueToday")}</Badge> : null}
        {task.fieldSubmittedAt ? <Badge size="sm" color="success">{t("tasks.reportReceived")}</Badge> : null}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <MobileInfo label={t("tasks.mobileAssignee")} value={assigneeLabel(task.assignedTo, t("tasks.unassigned"), t("common.unknown"))} />
        <MobileInfo label={t("tasks.mobileType")} value={taskTypeLabel(task.type, t)} />
        <MobileInfo label={t("tasks.mobileDue")} value={formatDate(task.dueAt, locale, "-")} />
        <MobileInfo
          label={t("tasks.mobileStarted")}
          value={task.startedAt ? formatDate(task.startedAt, locale, "-") : t("tasks.notStarted")}
        />
        <MobileInfo label={t("tasks.mobileMeter")} value={task.meter?.serialNumber || t("common.notAvailable")} />
        <MobileInfo label={t("tasks.mobileClient")} value={formatCustomer(task.meter?.customer, t("common.notAvailable"))} />
      </div>

      {(task.reading || task.reportedReading || task.resolutionCode) ? (
        <div className="mt-4 rounded-lg border border-gray-200 px-3 py-3 dark:border-gray-800">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("tasks.mobileFieldFollowUp")}</p>
          <div className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-300">
            {task.reading ? (
              <p>
                {t("tasks.sourceReading")}:{" "}
                <Link href={`/admin/readings/${task.reading.id}`} className="text-brand-600 hover:underline dark:text-brand-400">
                  {task.reading.status}
                </Link>
              </p>
            ) : null}
            {task.reportedReading ? (
              <p>
                {t("tasks.reportedReading")}:{" "}
                <Link href={`/admin/readings/${task.reportedReading.id}`} className="text-brand-600 hover:underline dark:text-brand-400">
                  {task.reportedReading.status}
                </Link>
              </p>
            ) : null}
            {task.resolutionCode ? <p>{t("tasks.mobileResolution")}: {task.resolutionCode}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MobileInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 px-3 py-2.5 dark:border-gray-800">
      <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-gray-800 dark:text-white/90">{value}</p>
    </div>
  );
}

function TaskAttentionCard({
  overdue,
  dueToday,
  unassigned,
  withReport,
  t,
}: {
  overdue: number;
  dueToday: number;
  unassigned: number;
  withReport: number;
  t: AdminTranslatorFn;
}) {
  const items = [
    {
      label: t("tasks.overdue"),
      value: overdue,
      hint: t("tasks.overdueHint"),
      valueClassName: "text-error-600 dark:text-error-400",
      borderClassName: "border-error-200 dark:border-error-500/20",
    },
    {
      label: t("tasks.dueToday"),
      value: dueToday,
      hint: t("tasks.dueTodayHint"),
      valueClassName: "text-warning-600 dark:text-warning-400",
      borderClassName: "border-warning-200 dark:border-warning-500/20",
    },
    {
      label: t("tasks.unassigned"),
      value: unassigned,
      hint: t("tasks.unassignedHint"),
      valueClassName: "text-gray-800 dark:text-white/90",
      borderClassName: "border-gray-200 dark:border-gray-800",
    },
    {
      label: t("tasks.reportsReceived"),
      value: withReport,
      hint: t("tasks.reportHint"),
      valueClassName: "text-success-600 dark:text-success-400",
      borderClassName: "border-success-200 dark:border-success-500/20",
    },
  ];

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
      <div>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t("tasks.operationalAlerts")}</p>
        <h3 className="mt-2 text-lg font-semibold text-gray-800 dark:text-white/90">{t("tasks.whatNeedsAttention")}</h3>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <div
            key={item.label}
            className={`rounded-xl border p-4 ${item.borderClassName} bg-gray-50/60 dark:bg-gray-900/40`}
          >
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{item.label}</p>
            <p className={`mt-2 text-2xl font-semibold ${item.valueClassName}`}>{item.value}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{item.hint}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
