"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { ApexOptions } from "apexcharts";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

type SeriesData = {
  labels: string[];
  values: number[];
};

type ValidationRateTrendChartProps = {
  monthly: SeriesData;
  quarterly: SeriesData;
  annual: SeriesData;
  visible: boolean;
};

type Mode = "monthly" | "quarterly" | "annual";

export default function ValidationRateTrendChart({
  monthly,
  quarterly,
  annual,
  visible,
}: ValidationRateTrendChartProps) {
  const [mode, setMode] = useState<Mode>("monthly");

  const current = useMemo(() => {
    if (mode === "quarterly") return quarterly;
    if (mode === "annual") return annual;
    return monthly;
  }, [annual, mode, monthly, quarterly]);

  const options: ApexOptions = {
    chart: {
      type: "area",
      toolbar: { show: false },
      fontFamily: "Outfit, sans-serif",
    },
    colors: ["#465FFF"],
    stroke: {
      width: 2.5,
      curve: "smooth",
    },
    fill: {
      type: "gradient",
      gradient: {
        opacityFrom: 0.35,
        opacityTo: 0.05,
      },
    },
    grid: { borderColor: "#e5e7eb" },
    dataLabels: { enabled: false },
    legend: { show: false },
    xaxis: {
      categories: current.labels,
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      min: 0,
      max: 100,
      tickAmount: 5,
      labels: {
        formatter: (val) => `${val.toFixed(0)}%`,
      },
    },
    tooltip: {
      y: {
        formatter: (val) => `${val.toFixed(2)}%`,
      },
    },
  };

  if (!visible) return null;

  return (
    <div className="mb-6 rounded-2xl border border-gray-200 bg-white px-5 pb-5 pt-5 dark:border-gray-800 dark:bg-white/[0.03] sm:px-6 sm:pt-6">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            Taux de validation des relevés
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            % de relevés validés sur l&apos;ensemble des décisions (validé/flag/rejet).
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
            Monthly
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
            Quarterly
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
            Annual
          </button>
        </div>
      </div>

      <Chart
        type="area"
        height={320}
        options={options}
        series={[{ name: "Validation rate", data: current.values }]}
      />
    </div>
  );
}
