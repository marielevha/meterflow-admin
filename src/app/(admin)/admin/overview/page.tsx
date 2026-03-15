import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ReadingStatus, TaskStatus } from "@prisma/client";
import { BoxCubeIcon, PieChartIcon, TaskIcon, UserCircleIcon } from "@/icons";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import ComponentCard from "@/components/common/ComponentCard";
import Badge from "@/components/ui/badge/Badge";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import OverviewActivityCharts from "@/components/overview/OverviewActivityCharts";
import ValidationRateTrendChart from "@/components/overview/ValidationRateTrendChart";
import OperationsKpisSection from "@/components/overview/OperationsKpisSection";
import { getOverviewDashboardData } from "@/lib/backoffice/overview";

export const metadata: Metadata = {
  title: "Overview",
  description: "Operational activity dashboard",
};

function formatDate(value: Date | string | null) {
  if (!value) return "N/A";
  const normalized = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(normalized.getTime())) return "N/A";
  return normalized.toISOString().slice(0, 19).replace("T", " ");
}

function readingStatusColor(status: ReadingStatus) {
  if (status === ReadingStatus.VALIDATED) return "success" as const;
  if (status === ReadingStatus.FLAGGED) return "warning" as const;
  if (status === ReadingStatus.REJECTED) return "error" as const;
  if (status === ReadingStatus.PENDING) return "info" as const;
  return "light" as const;
}

export default async function OverviewPage() {
  const overview = await getOverviewDashboardData();
  const { appSettings, recentReadings, recentTasks, metrics, charts } = overview;

  return (
    <div>
      <PageBreadcrumb pageTitle="Overview" />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Customers actifs"
          value={metrics.activeCustomersCount}
          hint={`Total clients: ${metrics.totalCustomersCount}`}
          icon={<UserCircleIcon />}
          trend={metrics.customersCoverage}
          trendLabel="actifs / total"
          trendPositive
        />
        <MetricCard
          label="Compteurs actifs"
          value={metrics.activeMetersCount}
          hint={`Total compteurs: ${metrics.totalMetersCount}`}
          icon={<BoxCubeIcon />}
          trend={metrics.metersCoverage}
          trendLabel="actifs / total"
          trendPositive
        />
        <MetricCard
          label="Releves aujourd'hui"
          value={metrics.todayReadingsCount}
          hint={`Hier: ${metrics.yesterdayReadingsCount} | Total: ${metrics.totalReadingsCount}`}
          icon={<TaskIcon />}
          trend={metrics.todayTrend}
          trendLabel="vs hier"
          trendPositive={metrics.todayTrend >= 0}
        />
        <MetricCard
          label="Volume 30 jours"
          value={metrics.volume30Days}
          hint={`30j précédents: ${metrics.prev30DaysReadingsCount}`}
          icon={<PieChartIcon />}
          trend={metrics.volumeTrend}
          trendLabel="vs 30j préc."
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
        <ComponentCard title="Recent readings" desc="Derniers releves a superviser.">
          <div className="max-w-full overflow-x-auto">
            <div className="min-w-[920px] overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
              <Table>
                <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                  <TableRow>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Date</TableCell>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Meter</TableCell>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Client</TableCell>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Index</TableCell>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Status</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                  {recentReadings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                        No readings found.
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
                          <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{formatDate(reading.createdAt)}</TableCell>
                          <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                            <p className="font-medium">{reading.meter.serialNumber}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{reading.meter.city || "-"} / {reading.meter.zone || "-"}</p>
                          </TableCell>
                          <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{customer}</TableCell>
                          <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                            {reading.primaryIndex.toString()}
                            {reading.secondaryIndex ? ` | ${reading.secondaryIndex.toString()}` : ""}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-sm">
                            <Badge size="sm" color={readingStatusColor(reading.status)}>{reading.status}</Badge>
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

        <ComponentCard title="Recent tasks" desc="Dernieres actions terrain.">
          <div className="max-w-full overflow-x-auto">
            <div className="min-w-[920px] overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
              <Table>
                <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                  <TableRow>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Title</TableCell>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Status</TableCell>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Meter</TableCell>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Assigned</TableCell>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">Date</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                  {recentTasks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">No tasks found.</TableCell>
                    </TableRow>
                  ) : (
                    recentTasks.map((task) => {
                      const assignee = [task.assignedTo?.firstName, task.assignedTo?.lastName].filter(Boolean).join(" ").trim() || task.assignedTo?.phone || "Unassigned";
                      return (
                        <TableRow key={task.id}>
                          <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{task.title}</TableCell>
                          <TableCell className="px-4 py-3 text-sm">
                            <Badge size="sm" color={task.status === TaskStatus.DONE ? "success" : task.status === TaskStatus.BLOCKED ? "error" : task.status === TaskStatus.IN_PROGRESS ? "info" : "warning"}>
                              {task.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{task.meter?.serialNumber || "N/A"}</TableCell>
                          <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{assignee}</TableCell>
                          <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{formatDate(task.createdAt)}</TableCell>
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
        processingDelay={{ monthly: charts.monthlyDelay, quarterly: charts.quarterlyDelay, annual: charts.annualDelay }}
        pendingBacklog={{ monthly: charts.monthlyBacklog, quarterly: charts.quarterlyBacklog, annual: charts.annualBacklog }}
        anomalyRate={{ monthly: charts.monthlyAnomaly, quarterly: charts.quarterlyAnomaly, annual: charts.annualAnomaly }}
        submittedVolume={{ monthly: charts.monthlyVolume, quarterly: charts.quarterlyVolume, annual: charts.annualVolume }}
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
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-gray-700 dark:bg-white/[0.06] dark:text-gray-200">{icon}</div>
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <h3 className="text-4xl font-semibold tracking-tight text-gray-800 dark:text-white/90">{value}</h3>
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
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{hint} · {trendLabel}</p>
    </div>
  );
}
