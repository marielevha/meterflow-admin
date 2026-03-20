"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { ApexOptions } from "apexcharts";
import { useAdminI18n } from "@/hooks/use-admin-i18n";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

type SeriesData = {
  labels: string[];
  values: number[];
};

type OperationsKpisSectionProps = {
  processingDelay: {
    monthly: SeriesData;
    quarterly: SeriesData;
    annual: SeriesData;
  };
  pendingBacklog: {
    monthly: SeriesData;
    quarterly: SeriesData;
    annual: SeriesData;
  };
  anomalyRate: {
    monthly: SeriesData;
    quarterly: SeriesData;
    annual: SeriesData;
  };
  submittedVolume: {
    monthly: SeriesData;
    quarterly: SeriesData;
    annual: SeriesData;
  };
  visibility: {
    delay: boolean;
    backlog: boolean;
    anomaly: boolean;
    volume: boolean;
  };
};

type Mode = "monthly" | "quarterly" | "annual";

export default function OperationsKpisSection({
  processingDelay,
  pendingBacklog,
  anomalyRate,
  submittedVolume,
  visibility,
}: OperationsKpisSectionProps) {
  const { t } = useAdminI18n();
  const [mode, setMode] = useState<Mode>("monthly");
  const hasVisibleKpi =
    visibility.delay || visibility.backlog || visibility.anomaly || visibility.volume;
  const delaySeries =
    mode === "quarterly"
      ? processingDelay.quarterly
      : mode === "annual"
        ? processingDelay.annual
        : processingDelay.monthly;
  const backlogSeries =
    mode === "quarterly"
      ? pendingBacklog.quarterly
      : mode === "annual"
        ? pendingBacklog.annual
        : pendingBacklog.monthly;
  const anomalySeries =
    mode === "quarterly" ? anomalyRate.quarterly : mode === "annual" ? anomalyRate.annual : anomalyRate.monthly;
  const volumeSeries =
    mode === "quarterly"
      ? submittedVolume.quarterly
      : mode === "annual"
        ? submittedVolume.annual
        : submittedVolume.monthly;

  if (!hasVisibleKpi) return null;

  const baseLineOptions = (labels: string[], color: string, percent = false): ApexOptions => ({
    chart: {
      type: "area",
      fontFamily: "Outfit, sans-serif",
      toolbar: { show: false },
    },
    colors: [color],
    stroke: { width: 2.5, curve: "smooth" },
    fill: {
      type: "gradient",
      gradient: {
        opacityFrom: 0.35,
        opacityTo: 0.06,
      },
    },
    dataLabels: { enabled: false },
    legend: { show: false },
    xaxis: {
      categories: labels,
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      min: 0,
      forceNiceScale: true,
      labels: {
        formatter: (val) => (percent ? `${val.toFixed(0)}%` : val.toFixed(0)),
      },
      ...(percent ? { max: 100 } : {}),
    },
    grid: { borderColor: "#e5e7eb" },
    tooltip: {
      y: {
        formatter: (val) => (percent ? `${val.toFixed(2)}%` : val.toFixed(2)),
      },
    },
  });

  const volumeOptions: ApexOptions = {
    chart: {
      type: "bar",
      fontFamily: "Outfit, sans-serif",
      toolbar: { show: false },
    },
    colors: ["#465FFF"],
    plotOptions: {
      bar: {
        borderRadius: 6,
        columnWidth: "48%",
      },
    },
    dataLabels: { enabled: false },
    legend: { show: false },
    xaxis: {
      categories: volumeSeries.labels,
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: { min: 0, forceNiceScale: true },
    grid: { borderColor: "#e5e7eb" },
  };

  return (
    <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] sm:p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">{t("overview.operationalKpis")}</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t("overview.pageDescription")}
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-gray-200 p-1 dark:border-gray-800">
          <button
            type="button"
            onClick={() => setMode("monthly")}
            className={`rounded-md px-3 py-1.5 text-sm ${
              mode === "monthly"
                ? "bg-brand-500 text-white"
                : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/[0.04]"
            }`}
          >
            {t("overview.monthly")}
          </button>
          <button
            type="button"
            onClick={() => setMode("quarterly")}
            className={`rounded-md px-3 py-1.5 text-sm ${
              mode === "quarterly"
                ? "bg-brand-500 text-white"
                : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/[0.04]"
            }`}
          >
            {t("overview.quarterly")}
          </button>
          <button
            type="button"
            onClick={() => setMode("annual")}
            className={`rounded-md px-3 py-1.5 text-sm ${
              mode === "annual"
                ? "bg-brand-500 text-white"
                : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/[0.04]"
            }`}
          >
            {t("overview.annual")}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {visibility.delay ? (
          <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
            <p className="text-sm font-medium text-gray-800 dark:text-white/90">{t("overview.delayTitle")}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {t("overview.delayDescription")}
            </p>
            <div className="mt-4">
              <Chart
                type="area"
                height={240}
                options={baseLineOptions(delaySeries.labels, "#0EA5E9")}
                series={[{ name: t("overview.delayTitle"), data: delaySeries.values }]}
              />
            </div>
          </div>
        ) : null}

        {visibility.backlog ? (
          <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
            <p className="text-sm font-medium text-gray-800 dark:text-white/90">{t("overview.backlogTitle")}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {t("overview.backlogDescription")}
            </p>
            <div className="mt-4">
              <Chart
                type="area"
                height={240}
                options={baseLineOptions(backlogSeries.labels, "#6366F1")}
                series={[{ name: t("overview.pending"), data: backlogSeries.values }]}
              />
            </div>
          </div>
        ) : null}

        {visibility.anomaly ? (
          <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
            <p className="text-sm font-medium text-gray-800 dark:text-white/90">
              {t("overview.anomalyTitle")}
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {t("overview.anomalyDescription")}
            </p>
            <div className="mt-4">
              <Chart
                type="area"
                height={240}
                options={baseLineOptions(anomalySeries.labels, "#EF4444", true)}
                series={[{ name: t("overview.anomalyTitle"), data: anomalySeries.values }]}
              />
            </div>
          </div>
        ) : null}

        {visibility.volume ? (
          <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
            <p className="text-sm font-medium text-gray-800 dark:text-white/90">{t("overview.volumeTitle")}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t("overview.volumeDescription")}</p>
            <div className="mt-4">
              <Chart
                type="bar"
                height={240}
                options={volumeOptions}
                series={[{ name: t("overview.volumeTitle"), data: volumeSeries.values }]}
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
