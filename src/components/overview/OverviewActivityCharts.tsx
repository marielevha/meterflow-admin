"use client";

import dynamic from "next/dynamic";
import { ApexOptions } from "apexcharts";
import { useAdminI18n } from "@/hooks/use-admin-i18n";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

type OverviewActivityChartsProps = {
  dailyLabels: string[];
  dailyTotal: number[];
  dailyPending: number[];
  dailyValidated: number[];
  dailyFlagged: number[];
  dailyRejected: number[];
  statusLabels: string[];
  statusValues: number[];
  taskStatusLabels: string[];
  taskStatusValues: number[];
  topAgentLabels: string[];
  topAgentValues: number[];
  riskyZoneLabels: string[];
  riskyZoneValues: number[];
  userRoleLabels: string[];
  userRoleValues: number[];
  visibility: {
    activityTrend: boolean;
    statusMix: boolean;
    tasksByStatus: boolean;
    topAgents: boolean;
    riskiestZones: boolean;
    userDistribution: boolean;
  };
};

export default function OverviewActivityCharts({
  dailyLabels,
  dailyTotal,
  dailyPending,
  dailyValidated,
  dailyFlagged,
  dailyRejected,
  statusLabels,
  statusValues,
  taskStatusLabels,
  taskStatusValues,
  topAgentLabels,
  topAgentValues,
  riskyZoneLabels,
  riskyZoneValues,
  userRoleLabels,
  userRoleValues,
  visibility,
}: OverviewActivityChartsProps) {
  const { t } = useAdminI18n();
  const translatedStatusLabels = statusLabels.map((label) => {
    switch (label.toUpperCase()) {
      case "PENDING":
        return t("overview.pending");
      case "VALIDATED":
        return t("overview.validated");
      case "FLAGGED":
        return t("overview.flagged");
      case "REJECTED":
        return t("overview.rejected");
      default:
        return t("overview.other");
    }
  });
  const translatedTaskStatusLabels = taskStatusLabels.map((label) => {
    switch (label.toUpperCase().replace(/\s+/g, "_")) {
      case "OPEN":
        return t("tasks.open");
      case "IN_PROGRESS":
        return t("tasks.inProgress");
      case "BLOCKED":
        return t("tasks.blocked");
      case "DONE":
        return t("tasks.done");
      case "CANCELED":
        return t("tasks.canceled");
      default:
        return label;
    }
  });
  const translatedUserRoleLabels = userRoleLabels.map((label) => {
    switch (label.toUpperCase()) {
      case "CLIENT":
        return t("overview.roleClient");
      case "AGENT":
        return t("overview.roleAgent");
      case "SUPERVISOR":
        return t("overview.roleSupervisor");
      case "ADMIN":
        return t("overview.roleAdmin");
      default:
        return label;
    }
  });
  const hasVisibleChart =
    visibility.activityTrend ||
    visibility.statusMix ||
    visibility.tasksByStatus ||
    visibility.topAgents ||
    visibility.riskiestZones ||
    visibility.userDistribution;

  if (!hasVisibleChart) return null;

  const activityOptions: ApexOptions = {
    chart: {
      type: "area",
      toolbar: { show: false },
      fontFamily: "Outfit, sans-serif",
    },
    colors: ["#465fff", "#9CB9FF", "#12B76A", "#F59E0B", "#EF4444"],
    stroke: { width: [3, 2, 2, 2, 2], curve: "smooth" },
    fill: {
      type: "gradient",
      gradient: {
        opacityFrom: 0.35,
        opacityTo: 0.05,
      },
    },
    dataLabels: { enabled: false },
    legend: { position: "top", horizontalAlign: "left" },
    xaxis: {
      categories: dailyLabels,
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: { min: 0, forceNiceScale: true },
    grid: { borderColor: "#e5e7eb" },
    tooltip: {
      shared: true,
      intersect: false,
    },
  };

  const statusOptions: ApexOptions = {
    chart: {
      type: "donut",
      fontFamily: "Outfit, sans-serif",
    },
    labels: translatedStatusLabels,
    legend: { position: "bottom" },
    dataLabels: { enabled: true },
    colors: ["#6b7280", "#3B82F6", "#F59E0B", "#EF4444", "#10B981"],
    stroke: { colors: ["transparent"] },
    plotOptions: {
      pie: {
        donut: {
          size: "68%",
        },
      },
    },
  };

  const taskOptions: ApexOptions = {
    chart: {
      type: "bar",
      toolbar: { show: false },
      fontFamily: "Outfit, sans-serif",
    },
    colors: ["#6366F1"],
    plotOptions: {
      bar: {
        borderRadius: 6,
        columnWidth: "45%",
      },
    },
    dataLabels: { enabled: false },
    xaxis: {
      categories: translatedTaskStatusLabels,
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: { min: 0, forceNiceScale: true },
    grid: { borderColor: "#e5e7eb" },
  };

  const topAgentsOptions: ApexOptions = {
    chart: {
      type: "bar",
      toolbar: { show: false },
      fontFamily: "Outfit, sans-serif",
    },
    colors: ["#0EA5E9"],
    plotOptions: {
      bar: {
        horizontal: true,
        borderRadius: 6,
      },
    },
    dataLabels: { enabled: false },
    xaxis: { min: 0 },
    yaxis: {
      labels: {
        maxWidth: 180,
      },
    },
    grid: { borderColor: "#e5e7eb" },
  };

  const riskZoneOptions: ApexOptions = {
    chart: {
      type: "bar",
      toolbar: { show: false },
      fontFamily: "Outfit, sans-serif",
    },
    colors: ["#EF4444"],
    plotOptions: {
      bar: {
        borderRadius: 6,
        columnWidth: "48%",
      },
    },
    dataLabels: { enabled: false },
    xaxis: {
      categories: riskyZoneLabels,
      labels: { rotate: -15 },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: { min: 0, max: 100, tickAmount: 5 },
    tooltip: {
      y: {
        formatter: (val: number) => `${val.toFixed(1)}%`,
      },
    },
    grid: { borderColor: "#e5e7eb" },
  };

  const userRoleOptions: ApexOptions = {
    chart: {
      type: "donut",
      fontFamily: "Outfit, sans-serif",
    },
    labels: translatedUserRoleLabels,
    legend: { position: "bottom" },
    dataLabels: { enabled: true },
    colors: ["#22C55E", "#3B82F6", "#F59E0B", "#EF4444"],
    stroke: { colors: ["transparent"] },
    plotOptions: {
      pie: {
        donut: {
          size: "68%",
        },
      },
    },
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      {visibility.activityTrend ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] xl:col-span-8">
          <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
            {t("overview.activityTrend")}
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t("overview.activityTrendDescription")}
          </p>
          <div className="mt-4">
            <Chart
              type="area"
              height={320}
              options={activityOptions}
              series={[
                { name: t("overview.total"), data: dailyTotal },
                { name: t("overview.pending"), data: dailyPending },
                { name: t("overview.validated"), data: dailyValidated },
                { name: t("overview.flagged"), data: dailyFlagged },
                { name: t("overview.rejected"), data: dailyRejected },
              ]}
            />
          </div>
        </div>
      ) : null}

      {visibility.statusMix ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] xl:col-span-4">
          <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
            {t("overview.statusMix")}
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t("overview.statusMixDescription")}
          </p>
          <div className="mt-4">
            <Chart type="donut" height={320} options={statusOptions} series={statusValues} />
          </div>
        </div>
      ) : null}

      {visibility.tasksByStatus ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] xl:col-span-4">
          <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
            {t("overview.tasksByStatus")}
          </h3>
          <div className="mt-4">
            <Chart
              type="bar"
              height={260}
              options={taskOptions}
              series={[{ name: t("overview.tasks"), data: taskStatusValues }]}
            />
          </div>
        </div>
      ) : null}

      {visibility.topAgents ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] xl:col-span-4">
          <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
            {t("overview.topAgentsWindow")}
          </h3>
          <div className="mt-4">
            <Chart
              type="bar"
              height={260}
              options={{
                ...topAgentsOptions,
                xaxis: { ...topAgentsOptions.xaxis, categories: topAgentLabels },
              }}
              series={[{ name: t("nav.readings"), data: topAgentValues }]}
            />
          </div>
        </div>
      ) : null}

      {visibility.riskiestZones ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] xl:col-span-4">
          <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
            {t("overview.riskiestZonesWindow")}
          </h3>
          <div className="mt-4">
            <Chart
              type="bar"
              height={260}
              options={riskZoneOptions}
              series={[{ name: t("overview.riskPercent"), data: riskyZoneValues }]}
            />
          </div>
        </div>
      ) : null}

      {visibility.userDistribution ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] xl:col-span-4">
          <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
            {t("overview.userDistribution")}
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t("overview.userDistributionDescription")}
          </p>
          <div className="mt-4">
            <Chart type="donut" height={260} options={userRoleOptions} series={userRoleValues} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
