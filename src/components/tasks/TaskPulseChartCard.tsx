"use client";

import dynamic from "next/dynamic";
import { ApexOptions } from "apexcharts";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

type TaskPulseChartCardProps = {
  counts: {
    total: number;
    open: number;
    inProgress: number;
    blocked: number;
    done: number;
    canceled: number;
  };
};

export default function TaskPulseChartCard({ counts }: TaskPulseChartCardProps) {
  const active = counts.open + counts.inProgress + counts.blocked;
  const activeRatio = counts.total > 0 ? Math.round((active / counts.total) * 100) : 0;
  const series = [counts.open, counts.inProgress, counts.blocked, counts.done, counts.canceled];

  const options: ApexOptions = {
    chart: {
      type: "donut",
      fontFamily: "Outfit, sans-serif",
      toolbar: { show: false },
    },
    labels: ["Open", "In progress", "Blocked", "Done", "Canceled"],
    colors: ["#465FFF", "#0EA5E9", "#EF4444", "#12B76A", "#98A2B3"],
    legend: { show: false },
    dataLabels: { enabled: false },
    stroke: { colors: ["transparent"] },
    tooltip: {
      y: {
        formatter: (value) => `${Number(value).toFixed(0)} task(s)`,
      },
    },
    plotOptions: {
      pie: {
        donut: {
          size: "72%",
        },
      },
    },
    responsive: [
      {
        breakpoint: 768,
        options: {
          chart: { height: 260 },
        },
      },
    ],
  };

  const items = [
    {
      label: "Open",
      value: counts.open,
      accentClassName: "bg-brand-500",
      textClassName: "text-brand-700 dark:text-brand-300",
    },
    {
      label: "In progress",
      value: counts.inProgress,
      accentClassName: "bg-blue-light-500",
      textClassName: "text-blue-light-700 dark:text-blue-light-300",
    },
    {
      label: "Blocked",
      value: counts.blocked,
      accentClassName: "bg-error-500",
      textClassName: "text-error-700 dark:text-error-300",
    },
    {
      label: "Done",
      value: counts.done,
      accentClassName: "bg-success-500",
      textClassName: "text-success-700 dark:text-success-300",
    },
    {
      label: "Canceled",
      value: counts.canceled,
      accentClassName: "bg-gray-400 dark:bg-gray-500",
      textClassName: "text-gray-700 dark:text-gray-300",
    },
  ];

  return (
    <div className="xl:col-span-2 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Task pulse</p>
          <div className="mt-2 flex items-end gap-3">
            <h3 className="text-3xl font-semibold text-gray-800 dark:text-white/90">{counts.total}</h3>
            <p className="pb-1 text-sm text-gray-500 dark:text-gray-400">
              total tasks, <span className="font-medium text-gray-700 dark:text-gray-200">{active}</span> active
            </p>
          </div>
        </div>
        <div className="min-w-[180px] rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-800">
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Active workload</p>
          <div className="mt-2 flex items-end gap-2">
            <span className="text-2xl font-semibold text-gray-800 dark:text-white/90">{activeRatio}%</span>
            <span className="pb-1 text-sm text-gray-500 dark:text-gray-400">of current queue</span>
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,320px)_1fr] lg:items-center">
        <div className="rounded-xl border border-gray-200 bg-gray-50/40 p-3 dark:border-gray-800 dark:bg-gray-900/40">
          <div className="relative">
            <Chart type="donut" height={280} options={options} series={series} />
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-semibold text-gray-800 dark:text-white/90">{counts.total}</span>
              <span className="mt-1 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Total tasks
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-gray-200 bg-gray-50/60 p-4 dark:border-gray-800 dark:bg-gray-900/40"
            >
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${item.accentClassName}`} />
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{item.label}</p>
              </div>
              <p className={`mt-3 text-2xl font-semibold ${item.textClassName}`}>{item.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
