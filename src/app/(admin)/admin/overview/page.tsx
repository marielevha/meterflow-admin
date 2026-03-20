import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ReadingStatus, TaskStatus } from "@prisma/client";
import Link from "next/link";
import { BoxCubeIcon, PieChartIcon, TaskIcon, UserCircleIcon } from "@/icons";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import ComponentCard from "@/components/common/ComponentCard";
import Badge from "@/components/ui/badge/Badge";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import OverviewActivityCharts from "@/components/overview/OverviewActivityCharts";
import ValidationRateTrendChart from "@/components/overview/ValidationRateTrendChart";
import OperationsKpisSection from "@/components/overview/OperationsKpisSection";
import { getOverviewDashboardData } from "@/lib/backoffice/overview";
import { getAdminTranslator } from "@/lib/admin-i18n/server";

export const metadata: Metadata = {
  title: "Overview",
  description: "Operational activity dashboard",
};

function formatDate(value: Date | string | null, locale: string, fallback: string) {
  if (!value) return fallback;
  const normalized = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(normalized.getTime())) return fallback;

  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(normalized);
}

function readingStatusColor(status: ReadingStatus) {
  if (status === ReadingStatus.VALIDATED) return "success" as const;
  if (status === ReadingStatus.FLAGGED) return "warning" as const;
  if (status === ReadingStatus.REJECTED) return "error" as const;
  if (status === ReadingStatus.PENDING) return "info" as const;
  return "light" as const;
}

function readingStatusLabel(
  status: ReadingStatus,
  t: (key: string, values?: Record<string, string | number>) => string
) {
  switch (status) {
    case ReadingStatus.PENDING:
      return t("overview.pending");
    case ReadingStatus.VALIDATED:
      return t("overview.validated");
    case ReadingStatus.FLAGGED:
      return t("overview.flagged");
    case ReadingStatus.REJECTED:
      return t("overview.rejected");
    default:
      return status;
  }
}

function taskStatusLabel(
  status: TaskStatus,
  t: (key: string, values?: Record<string, string | number>) => string
) {
  switch (status) {
    case TaskStatus.OPEN:
      return t("tasks.open");
    case TaskStatus.IN_PROGRESS:
      return t("tasks.inProgress");
    case TaskStatus.BLOCKED:
      return t("tasks.blocked");
    case TaskStatus.DONE:
      return t("tasks.done");
    case TaskStatus.CANCELED:
      return t("tasks.canceled");
    default:
      return status;
  }
}

export default async function OverviewPage() {
  const { locale, t } = await getAdminTranslator();
  const localeCode = locale === "fr" ? "fr-FR" : locale === "ln" ? "ln-CG" : "en-US";
  const overview = await getOverviewDashboardData(localeCode);
  const { appSettings, recentReadings, recentTasks, metrics, charts, supervision } = overview;

  return (
    <div>
      <PageBreadcrumb pageTitle={t("overview.pageTitle")} />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label={t("overview.activeCustomers")}
          value={metrics.activeCustomersCount}
          hint={`${t("overview.totalCustomers")}: ${metrics.totalCustomersCount}`}
          icon={<UserCircleIcon />}
          trend={metrics.customersCoverage}
          trendLabel={t("overview.activeOverTotal")}
          trendPositive
        />
        <MetricCard
          label={t("overview.activeMeters")}
          value={metrics.activeMetersCount}
          hint={`${t("overview.totalMeters")}: ${metrics.totalMetersCount}`}
          icon={<BoxCubeIcon />}
          trend={metrics.metersCoverage}
          trendLabel={t("overview.activeOverTotal")}
          trendPositive
        />
        <MetricCard
          label={t("overview.readingsToday")}
          value={metrics.todayReadingsCount}
          hint={`${t("overview.yesterday")}: ${metrics.yesterdayReadingsCount} | ${t("common.total")}: ${metrics.totalReadingsCount}`}
          icon={<TaskIcon />}
          trend={metrics.todayTrend}
          trendLabel={t("overview.vsYesterday")}
          trendPositive={metrics.todayTrend >= 0}
        />
        <MetricCard
          label={t("overview.volume30Days")}
          value={metrics.volume30Days}
          hint={`${t("overview.previous30Days")}: ${metrics.prev30DaysReadingsCount}`}
          icon={<PieChartIcon />}
          trend={metrics.volumeTrend}
          trendLabel={t("overview.vsPrevious30Days")}
          trendPositive={metrics.volumeTrend >= 0}
        />
      </div>

      <ValidationRateTrendChart
        monthly={charts.validationRateMonthly}
        quarterly={charts.validationRateQuarterly}
        annual={charts.validationRateAnnual}
        visible={appSettings.showOverviewValidationRate}
      />

      <OverviewActivityCharts
        dailyLabels={charts.dailyLabels}
        dailyTotal={charts.dailyTotal}
        dailyPending={charts.dailyPending}
        dailyValidated={charts.dailyValidated}
        dailyFlagged={charts.dailyFlagged}
        dailyRejected={charts.dailyRejected}
        statusLabels={charts.statusLabels}
        statusValues={charts.statusValues}
        taskStatusLabels={charts.taskStatusLabels}
        taskStatusValues={charts.taskStatusValues}
        topAgentLabels={charts.topAgentLabels}
        topAgentValues={charts.topAgentValues}
        riskyZoneLabels={charts.riskyZoneLabels}
        riskyZoneValues={charts.riskyZoneValues}
        userRoleLabels={charts.userRoleLabels}
        userRoleValues={charts.userRoleValues}
        visibility={{
          activityTrend: appSettings.showOverviewActivityTrend,
          statusMix: appSettings.showOverviewStatusMix,
          tasksByStatus: appSettings.showOverviewTasksByStatus,
          topAgents: appSettings.showOverviewTopAgents,
          riskiestZones: appSettings.showOverviewRiskiestZones,
          userDistribution: appSettings.showOverviewUserDistribution,
        }}
      />

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ComponentCard
          title={t("overview.supervisionTitle")}
          desc={t("overview.supervisionDescription")}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <SupervisionCard
              label={t("overview.tasksOpen")}
              value={supervision.openTasksCount}
              hint={t("overview.openTasksHint")}
              tone="info"
              badgeLabel={t("tasks.open")}
            />
            <SupervisionCard
              label={t("overview.tasksOverdue")}
              value={supervision.overdueTasksCount}
              hint={t("overview.overdueTasksHint")}
              tone="error"
              badgeLabel={t("tasks.overdue")}
            />
            <SupervisionCard
              label={t("overview.tasksDueToday")}
              value={supervision.dueTodayTasksCount}
              hint={t("overview.dueTodayTasksHint")}
              tone="warning"
              badgeLabel={t("tasks.dueToday")}
            />
          </div>

          <div className="mt-5 flex justify-end">
            <Link
              href="/admin/tasks"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.03]"
            >
              {t("overview.openTasksCta")}
            </Link>
          </div>
        </ComponentCard>

        <ComponentCard
          title={t("overview.workloadByAgentTitle")}
          desc={t("overview.workloadByAgentDescription")}
        >
          <div className="max-w-full overflow-x-auto">
            <div className="min-w-[720px] overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
              <Table>
                <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                  <TableRow>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                      {t("common.assignee")}
                    </TableCell>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                      {t("tasks.open")}
                    </TableCell>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                      {t("tasks.inProgress")}
                    </TableCell>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                      {t("tasks.blocked")}
                    </TableCell>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                      {t("tasks.done")}
                    </TableCell>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                      {t("overview.activeTotal")}
                    </TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                  {supervision.agentLoad.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400"
                      >
                        {t("overview.noActiveAgents")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    supervision.agentLoad.map((agent) => (
                      <TableRow key={agent.id}>
                        <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          {agent.label}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          {agent.open}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          {agent.inProgress}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          {agent.blocked}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          {agent.done}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm font-medium text-gray-800 dark:text-white/90">
                          {agent.totalActive}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </ComponentCard>

        <ComponentCard
          title={t("overview.recentReadingsTitle")}
          desc={t("overview.recentReadingsDescription")}
        >
          <div className="max-w-full overflow-x-auto">
            <div className="min-w-[920px] overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
              <Table>
                <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                  <TableRow>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                      {t("common.date")}
                    </TableCell>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                      {t("common.meter")}
                    </TableCell>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                      {t("common.customer")}
                    </TableCell>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                      {t("common.index")}
                    </TableCell>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                      {t("common.status")}
                    </TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                  {recentReadings.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400"
                      >
                        {t("overview.noReadingsFound")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    recentReadings.map((reading) => {
                      const customer =
                        [reading.submittedBy.firstName, reading.submittedBy.lastName]
                          .filter(Boolean)
                          .join(" ")
                          .trim() || reading.submittedBy.phone;

                      return (
                        <TableRow key={reading.id}>
                          <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                            {formatDate(reading.createdAt, localeCode, t("common.notAvailable"))}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                            <p className="font-medium">{reading.meter.serialNumber}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {reading.meter.city || "-"} / {reading.meter.zone || "-"}
                            </p>
                          </TableCell>
                          <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                            {customer}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                            {reading.primaryIndex.toString()}
                            {reading.secondaryIndex ? ` | ${reading.secondaryIndex.toString()}` : ""}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-sm">
                            <Badge size="sm" color={readingStatusColor(reading.status)}>
                              {readingStatusLabel(reading.status, t)}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </ComponentCard>

        <ComponentCard
          title={t("overview.recentTasksTitle")}
          desc={t("overview.recentTasksDescription")}
        >
          <div className="max-w-full overflow-x-auto">
            <div className="min-w-[920px] overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
              <Table>
                <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                  <TableRow>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                      {t("common.title")}
                    </TableCell>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                      {t("common.status")}
                    </TableCell>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                      {t("common.meter")}
                    </TableCell>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                      {t("common.assignee")}
                    </TableCell>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                      {t("common.date")}
                    </TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                  {recentTasks.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400"
                      >
                        {t("overview.noTasksFound")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    recentTasks.map((task) => {
                      const assignee =
                        [task.assignedTo?.firstName, task.assignedTo?.lastName]
                          .filter(Boolean)
                          .join(" ")
                          .trim() || task.assignedTo?.phone || t("tasks.unassigned");

                      return (
                        <TableRow key={task.id}>
                          <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                            {task.title}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-sm">
                            <Badge
                              size="sm"
                              color={
                                task.status === TaskStatus.DONE
                                  ? "success"
                                  : task.status === TaskStatus.BLOCKED
                                    ? "error"
                                    : task.status === TaskStatus.IN_PROGRESS
                                      ? "info"
                                      : "warning"
                              }
                            >
                              {taskStatusLabel(task.status, t)}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                            {task.meter?.serialNumber || t("common.notAvailable")}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                            {assignee}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                            {formatDate(task.createdAt, localeCode, t("common.notAvailable"))}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </ComponentCard>
      </div>

      <OperationsKpisSection
        processingDelay={{
          monthly: charts.monthlyDelay,
          quarterly: charts.quarterlyDelay,
          annual: charts.annualDelay,
        }}
        pendingBacklog={{
          monthly: charts.monthlyBacklog,
          quarterly: charts.quarterlyBacklog,
          annual: charts.annualBacklog,
        }}
        anomalyRate={{
          monthly: charts.monthlyAnomaly,
          quarterly: charts.quarterlyAnomaly,
          annual: charts.annualAnomaly,
        }}
        submittedVolume={{
          monthly: charts.monthlyVolume,
          quarterly: charts.quarterlyVolume,
          annual: charts.annualVolume,
        }}
        visibility={{
          delay: appSettings.showOverviewOpsDelay,
          backlog: appSettings.showOverviewOpsBacklog,
          anomaly: appSettings.showOverviewOpsAnomaly,
          volume: appSettings.showOverviewOpsVolume,
        }}
      />
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
  icon,
  trend,
  trendLabel,
  trendPositive,
}: {
  label: string;
  value: number;
  hint: string;
  icon: ReactNode;
  trend: number;
  trendLabel: string;
  trendPositive: boolean;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-gray-700 dark:bg-white/[0.06] dark:text-gray-200">
        {icon}
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <h3 className="text-4xl font-semibold tracking-tight text-gray-800 dark:text-white/90">
          {value}
        </h3>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
            trendPositive
              ? "bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-400"
              : "bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-400"
          }`}
        >
          {trendPositive ? "↑" : "↓"} {Math.abs(trend).toFixed(2)}%
        </span>
      </div>
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        {hint} · {trendLabel}
      </p>
    </div>
  );
}

function SupervisionCard({
  label,
  value,
  hint,
  tone,
  badgeLabel,
}: {
  label: string;
  value: number;
  hint: string;
  tone: "info" | "warning" | "error";
  badgeLabel: string;
}) {
  const badgeClass =
    tone === "error"
      ? "bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-400"
      : tone === "warning"
        ? "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400"
        : "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300";

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-white/[0.02]">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-3xl font-semibold tracking-tight text-gray-800 dark:text-white/90">
          {value}
        </p>
        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${badgeClass}`}>{badgeLabel}</span>
      </div>
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{hint}</p>
    </div>
  );
}
